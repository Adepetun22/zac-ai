class AIService {
  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || ''
  }

  async generateResponse(prompt, modelId = 'openrouter/google/gemma-4-26b-a4b-it:free', type = 'text') {
    try {
      const result = await this.callBackendAI(prompt, modelId, type);
      if (result !== null && result !== undefined) {
        if (type === 'structured' && result.schema) return result.schema
        if (type === 'image' && result.imageUrl) return result.imageUrl
        if (result.text) return result.text
        return result
      }
    } catch (error) {
      console.warn(`Primary model ${modelId} failed:`, error.message);
      // Try fallback models when the primary model fails
      const fallbackModels = this.getFallbackModels(modelId);
      for (const fallbackModel of fallbackModels) {
        try {
          console.log(`Trying fallback model: ${fallbackModel}`);
          const result = await this.callBackendAI(prompt, fallbackModel, type);
          if (result !== null && result !== undefined) {
            if (type === 'structured' && result.schema) return result.schema
            if (type === 'image' && result.imageUrl) return result.imageUrl
            if (result.text) return result.text
            return result
          }
        } catch (fallbackError) {
          console.warn(`Fallback model ${fallbackModel} also failed:`, fallbackError.message);
          continue; // Try the next fallback model
        }
      }
    }
    
    if (type === 'structured') return this.simulateStructuredResponse(prompt, modelId)
    return this.simulateAIResponse(prompt, modelId)
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
      type: 'bar', title: prompt.slice(0, 40), model: modelId,
      data: [
        { label: 'A', value: Math.floor(Math.random() * 80 + 20) },
        { label: 'B', value: Math.floor(Math.random() * 80 + 20) },
        { label: 'C', value: Math.floor(Math.random() * 80 + 20) },
      ],
    }
  }

  async callBackendAI(prompt, modelId, type = 'text') {
    try {
      console.log('[DEBUG] Sending request to backend with modelId:', modelId, 'and prompt:', prompt.substring(0, 50) + '...');
      const response = await fetch(
        this.backendUrl ? `${this.backendUrl}/ai` : '/ai',
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          modelId,
          type
        })
      });

      console.log('[DEBUG] Backend response status:', response.status);
      const data = await response.json();
      console.log('[DEBUG] Backend response data:', data);
      
      if (!response.ok) {
        const message = data?.error || `HTTP ${response.status}`;
        console.error('[ERROR] Backend AI API error:', response.status, message, data.detail);
        throw new Error(`Backend AI API error ${response.status}: ${message}`);
      }

      return data;
    } catch (error) {
      const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch'
      if (isNetworkError) {
        console.warn('[WARN] Backend AI proxy is unavailable at', this.backendUrl, '- falling back to simulated response.');
        return null;
      }
      console.warn('Backend AI call failed:', error.message, error.stack);
      throw error;
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
      'openrouter/openai/gpt-oss-20b:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/cohere/north-mini-code:free',
        'openrouter/anthropic/claude-3-haiku:free'
      ],
      'openrouter/poolside/laguna-s-2.1:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/cohere/north-mini-code:free',
        'openrouter/openai/gpt-oss-20b:free'
      ],
      'openrouter/cohere/north-mini-code:free': [
        'openrouter/google/gemma-4-26b-a4b-it:free',
        'openrouter/openai/gpt-oss-20b:free',
        'openrouter/anthropic/claude-3-haiku:free'
      ],
      'openrouter/google/gemma-4-26b-a4b-it:free': [
        'openrouter/cohere/north-mini-code:free',
        'openrouter/openai/gpt-oss-20b:free',
        'openrouter/anthropic/claude-3-haiku:free'
      ]
    };
    
    // Return the fallback chain for the given model, or a general fallback list
    return fallbackChains[primaryModelId] || [
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/cohere/north-mini-code:free',
      'openrouter/anthropic/claude-3-haiku:free',
      'openrouter/openai/gpt-oss-20b:free'
    ];
  }
}

export default new AIService();