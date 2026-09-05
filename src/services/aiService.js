// Typed error so callers can distinguish "the AI provider rejected this" from
// "the app itself is misconfigured". `kind` is one of:
//   - 'provider' — upstream AI provider returned an error (4xx/5xx/network). May be transient; fallbacks are appropriate.
//   - 'code'     — the app itself is misconfigured (missing server API key, bad model id, internal bug). Fallbacks won't help.
// Both carry `code` (string machine-readable), `provider`, `status`, `detail`, `retriable`.
export class AIError extends Error {
  constructor(message, { kind, code, provider, modelId, status, detail, retriable }) {
    super(message)
    this.name = 'AIError'
    this.kind = kind
    this.code = code || 'UNKNOWN'
    this.provider = provider || null
    this.modelId = modelId || null
    this.status = status || null
    this.detail = detail || null
    this.retriable = !!retriable
  }
  isProvider() { return this.kind === 'provider' }
  isCode() { return this.kind === 'code' }
}

// Human-readable explanation of a backend error code, for UI surfaces.
export function explainError(err) {
  if (!(err instanceof AIError)) return err?.message || String(err)
  switch (err.code) {
    case 'MISSING_API_KEY':
      return `The ${err.provider || 'AI'} server is missing its API key. Add the env var (e.g. OPENROUTER_API_KEY) to your Render dashboard and redeploy.`
    case 'INVALID_API_KEY':
      return `${err.provider || 'The AI provider'} rejected the API key (HTTP ${err.status || 401}). Check that the key is correct, has not expired, and the right env var is set on Render.`
    case 'RATE_LIMITED':
      return `${err.provider || 'The AI provider'} rate-limited this request (HTTP 429). Wait a moment and try again, or pick a different model.`
    case 'MODEL_NOT_FOUND':
      return `The selected model is not available on ${err.provider || 'the provider'} (HTTP 404). Pick a different model.`
    case 'BAD_REQUEST':
      return `${err.provider || 'The provider'} rejected the request as malformed (HTTP 400). The prompt may be too long or contain unsupported content.`
    case 'UPSTREAM_TIMEOUT':
      return `${err.provider || 'The provider'} timed out. Try again or pick a different model.`
    case 'UPSTREAM_UNAVAILABLE':
      return `${err.provider || 'The provider'} is temporarily unavailable (HTTP ${err.status || 502}). Try again shortly.`
    case 'UNSUPPORTED_PROVIDER':
      return `The selected model targets an unsupported provider. This is a code/configuration issue.`
    case 'NETWORK':
      return `Could not reach the backend at ${err.detail?.backendUrl || 'the configured URL'}. Is the Render service running?`
    case 'INTERNAL_ERROR':
      return `The AI backend hit an unexpected error: ${err.message}`
    default:
      return err.message || 'Unknown AI error'
  }
}

class AIService {
  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || ''
  }

  async generateResponse(prompt, modelId = 'openrouter/google/gemma-4-26b-a4b-it:free', type = 'text', apiKey = null) {
    try {
      const result = await this.callBackendAI(prompt, modelId, type, apiKey);
      if (result !== null && result !== undefined) {
        if (type === 'structured') {
          if (result.schema && typeof result.schema === 'object') return result.schema
          if (result.type) return result
        }
        if (type === 'image' && result.imageUrl) return result.imageUrl
        if (result.text) return result.text
        return result
      }
    } catch (error) {
      console.warn(`Primary model ${modelId} failed:`, error.message, `(kind=${error.kind || 'unknown'}, code=${error.code || 'unknown'})`)

      // Config / code errors (MISSING_API_KEY, INVALID_API_KEY, UNSUPPORTED_PROVIDER,
      // INTERNAL_ERROR, NETWORK) won't be fixed by trying a different model from the
      // same provider. Bail out immediately so the caller sees the real reason —
      // don't bury it under a fake "Hello" simulated response.
      if (error?.kind === 'code') throw error;

      // Provider errors (RATE_LIMITED, UPSTREAM_UNAVAILABLE, MODEL_NOT_FOUND,
      // BAD_REQUEST, UPSTREAM_TIMEOUT) may be transient. Try other providers in
      // the fallback chain, but skip ones from the same provider — they share
      // the same API key and will fail identically.
      if (type !== 'structured') {
        const fallbackModels = this.getFallbackModels(modelId)
        for (const fallbackModel of fallbackModels) {
          if (this.resolveProvider(fallbackModel) === this.resolveProvider(modelId)) continue
          try {
            const result = await this.callBackendAI(prompt, fallbackModel, type, null)
            if (result !== null && result !== undefined) {
              if (type === 'image' && result.imageUrl) return result.imageUrl
              if (result.text) return result.text
              return result
            }
          } catch (fallbackError) {
            // If a fallback hits a code error too, stop — further retries won't help.
            if (fallbackError?.kind === 'code') throw fallbackError
            console.warn(`Fallback model ${fallbackModel} also failed:`, fallbackError.message, `(kind=${fallbackError.kind || 'unknown'})`)
            continue
          }
        }
      }
    }

    // Provider error only — simulate so the UI still shows *something* during
    // transient outages. If a code error reached this point, we already threw above.
    if (type === 'structured') return this.simulateStructuredResponse(prompt, modelId)
    return this.simulateAIResponse(prompt, modelId)
  }

  // Lightweight provider resolution mirroring the backend's resolveProvider.
  resolveProvider(modelId = '') {
    const id = modelId.toLowerCase()
    if (id.startsWith('openrouter/')) return 'openrouter'
    if (id.startsWith('anthropic/')) return 'anthropic'
    if (id.startsWith('openai/')) return 'openai'
    if (id.startsWith('google/') || id.includes('gemini') || id.includes('flash-image')) return 'google'
    if (id.includes('llama') || id.includes('mistral')) return 'openrouter'
    if (id.startsWith('flux') || id.startsWith('stable') || id.includes('black-forest') || id.includes('stability')) return 'openrouter-image'
    if (id.includes('gpt') || id.includes('openai')) return 'openai'
    if (id.includes('claude') || id.includes('anthropic')) return 'anthropic'
    if (id.includes('hugging') || id.includes('hf-')) return 'huggingface'
    return 'openrouter'
  }

  async generateImage(prompt, modelId = 'huggingface/free-image') {
    const result = await this.callBackendImage(prompt, modelId)
    if (result && result.imageUrl) return result.imageUrl
    throw new Error(`Image generation not available for ${modelId}`)
  }

  async callBackendImage(prompt, _modelId) {
    try {
      const url = this.backendUrl
        ? `${this.backendUrl}/image?prompt=${encodeURIComponent(prompt)}`
        : `/image?prompt=${encodeURIComponent(prompt)}`
      const response = await fetch(url)
      if (!response.ok) {
        const text = await response.text()
        console.error('[ERROR] Backend image API error:', response.status, text)
        return null
      }
      return await response.json()
    } catch (error) {
      console.error('Backend image call failed:', error.message)
      return null
    }
  }

  simulateAIResponse(prompt, modelId) {
    const responses = {
      'llama-3-70b': `This is a simulated response from Llama 3 70B for your prompt: "${prompt}". In a real implementation, this would connect to the Meta AI API.`,
      'google/gemini-2.5-flash-image': `This is a simulated response from Google Gemini for your prompt: "${prompt}". In a real implementation, this would connect to the Google AI API.`
    };

    return responses[modelId] || `Simulated response for: ${prompt}`;
  }

  simulateStructuredResponse(prompt, modelId) {
    const p = prompt.toLowerCase()
    if (p.includes('q3') || p.includes('quarter') || p.includes('revenue') || p.includes('sales')) {
      return {
        type: 'bar', title: 'Q3 Revenue Summary', model: modelId,
        data: [
          { label: 'Jul', value: 42000 }, { label: 'Aug', value: 58000 },
          { label: 'Sep', value: 51000 },
        ],
      }
    }
    if (p.includes('trend') || p.includes('growth') || p.includes('over time') || p.includes('weekly')) {
      return {
        type: 'line', title: 'Growth Trend', model: modelId,
        data: [
          { label: 'W1', value: 120 }, { label: 'W2', value: 145 },
          { label: 'W3', value: 132 }, { label: 'W4', value: 178 },
        ],
      }
    }
    if (p.includes('breakdown') || p.includes('distribution') || p.includes('share') || p.includes('usage')) {
      return {
        type: 'pie', title: 'Usage Distribution', model: modelId,
        data: [
          { label: 'GPT-4o', value: 45 }, { label: 'Claude', value: 30 },
          { label: 'Gemini', value: 15 }, { label: 'Other', value: 10 },
        ],
      }
    }
    if (p.includes('table') || p.includes('list') || p.includes('log') || p.includes('summar')) {
      return {
        type: 'table', title: 'Activity Summary', model: modelId,
        data: [
          { label: 'GPT-4o', value: '45.2K requests' },
          { label: 'Claude 3.5', value: '32.1K requests' },
          { label: 'Gemini Pro', value: '28.4K requests' },
        ],
      }
    }
    return {
      type: 'bar', title: prompt.slice(0, 40), model: modelId || 'google/gemini-2.0-flash',
      data: [
        { label: 'A', value: Math.floor(Math.random() * 80 + 20) },
        { label: 'B', value: Math.floor(Math.random() * 80 + 20) },
        { label: 'C', value: Math.floor(Math.random() * 80 + 20) },
      ],
    }
  }

  async callBackendAI(prompt, modelId, type = 'text', apiKey = null) {
    try {
      console.log('[DEBUG] Sending request to backend with modelId:', modelId, 'and prompt:', prompt.substring(0, 50) + '...');
      const body = { prompt, modelId, type }
      if (apiKey) body.apiKey = apiKey
      const response = await fetch(
        this.backendUrl ? `${this.backendUrl}/ai` : '/ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      console.log('[DEBUG] Backend response status:', response.status);
      let data = null
      try { data = await response.json() } catch { /* non-JSON */ }

      if (!response.ok) {
        // Backend returns a structured error envelope; surface it as an AIError so callers
        // can distinguish code/config errors (won't be fixed by retries/fallbacks) from
        // provider errors (may be transient).
        const code = data?.code || 'BACKEND_ERROR'
        const kind = data?.kind === 'code' ? 'code' : 'provider'
        const message = data?.error || `Backend returned HTTP ${response.status}`
        console.error('[ERROR] Backend AI API error:', response.status, code, message);
        throw new AIError(message, {
          kind,
          code,
          provider: data?.provider || null,
          modelId,
          status: response.status,
          detail: data?.detail || data,
          retriable: !!data?.retriable,
        })
      }

      console.log('[DEBUG] Backend response data:', data);

      if (type === 'text' && data.text && typeof data.text === 'string') {
        const trimmed = data.text.trim()
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              const preferredKeys = ['message', 'text', 'response', 'content', 'reply', 'answer', 'output']
              for (const key of preferredKeys) {
                if (parsed[key] && typeof parsed[key] === 'string') {
                  data.text = parsed[key]
                  break
                }
              }
              if (data.text === trimmed) {
                const firstString = Object.values(parsed).find(v => typeof v === 'string')
                if (firstString) data.text = firstString
              }
            }
          } catch { /* ignore */ }
        }
      }

      return data;
    } catch (error) {
      // Re-throw typed errors as-is.
      if (error instanceof AIError) throw error

      const isNetworkError = error instanceof TypeError && /failed to fetch|networkerror/i.test(error.message)
      if (isNetworkError) {
        // The backend is unreachable. This is a CODE error (our deployment is broken),
        // not a provider error — surfacing it as such stops callers from hammering
        // OpenRouter etc. with no chance of success.
        console.warn('[WARN] Backend AI proxy is unavailable at', this.backendUrl, '- network error.');
        throw new AIError(`Cannot reach AI backend at ${this.backendUrl || '/ai'}`, {
          kind: 'code',
          code: 'NETWORK',
          provider: null,
          modelId,
          status: 0,
          detail: { backendUrl: this.backendUrl },
          retriable: true,
        })
      }
      console.warn('Backend AI call failed:', error.message, error.stack);
      throw new AIError(error.message || 'Unknown backend error', {
        kind: 'code',
        code: 'INTERNAL_ERROR',
        provider: null,
        modelId,
        status: null,
        detail: null,
        retriable: false,
      })
    }
  }

  // Removed direct API call methods since they're handled by the backend proxy
  // callOpenAI, callAnthropic, and callHuggingFace are now handled server-side

  // Method to get available models
  getAvailableModels() {
    return [
      { 
        id: 'llama-3-70b', 
        name: 'Llama 3 70B', 
        provider: 'Meta', 
        status: 'active', 
        cost: 0.05, 
        latency: 600, 
        api_requests: 0, 
        tokens_processed: 0,
        capabilities: ['text', 'code', 'chat']
      },
      { 
        id: 'google/gemini-2.5-flash-image', 
        name: 'Gemini 2.5 Flash Image', 
        provider: 'Google', 
        status: 'active', 
        cost: 0.001, 
        latency: 3000, 
        api_requests: 0, 
        tokens_processed: 0,
        capabilities: ['text', 'image', 'multimodal']
      },
    ];
  }

  // Helper method to get fallback models based on the primary model
  getFallbackModels(primaryModelId) {
    // Define fallback chains for different models
    const fallbackChains = {
      'google/gemini-2.0-flash': [
        'google/gemini-2.0-pro',
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/openai/gpt-oss-20b:free'
      ],
      'openrouter/openai/gpt-oss-20b:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/cohere/north-mini-code:free',
        'openrouter/poolside/laguna-s-2.1:free'
      ],
      'openrouter/cohere/north-mini-code:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/openai/gpt-oss-20b:free',
        'openrouter/poolside/laguna-s-2.1:free'
      ],
      'openrouter/poolside/laguna-s-2.1:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/openai/gpt-oss-20b:free',
        'openrouter/cohere/north-mini-code:free'
      ],
      'openrouter/google/gemma-4-26b-a4b-it:free': [
        'openrouter/openai/gpt-oss-20b:free',
        'openrouter/cohere/north-mini-code:free',
        'openrouter/poolside/laguna-s-2.1:free'
      ]
    };
    
    // Return the fallback chain for the given model, or a general fallback list
    return fallbackChains[primaryModelId] || [
      'google/gemini-2.0-flash',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/openai/gpt-oss-20b:free'
    ];
  }
}

export default new AIService();