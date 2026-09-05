import express from 'express'
import cors from 'cors'
import axios from 'axios'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { Liveblocks } from '@liveblocks/node'

dotenv.config()

const app = express()
const PORT = process.env.PORT || process.env.AI_PROXY_PORT || 8787

const allowedOrigins = [
  'https://zac-ai.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
]
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    providers: {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      google: !!process.env.GOOGLE_GEMINI_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    },
    liveblocks: !!process.env.LIVEBLOCKS_SECRET_KEY,
  });
});

// ── Liveblocks auth ─────────────────────────────────────────
//
// The browser Liveblocks client calls this endpoint to mint a short-lived
// access token for the current user. Without it the WebSocket connection
// fails with "Timed out during websocket connection" because the client
// can't authenticate. Requires LIVEBLOCKS_SECRET_KEY on the server.
const liveblocks = process.env.LIVEBLOCKS_SECRET_KEY
  ? new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY })
  : null

app.post('/api/liveblocks-auth', async (req, res) => {
  if (!liveblocks) {
    return res.status(503).json({
      error: 'Liveblocks not configured on server',
      detail: 'LIVEBLOCKS_SECRET_KEY is missing on the backend. Set it in the Render dashboard.',
    })
  }

  // Pull Supabase auth from headers (browser sends the access token after login).
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token || !supabase) {
    return res.status(401).json({
      error: 'forbidden',
      reason: 'Missing or invalid auth token. Sign in first.',
    })
  }

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) {
      return res.status(401).json({
        error: 'forbidden',
        reason: 'Could not verify user identity.',
      })
    }

    const { room } = req.body || {}
    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        avatar: user.user_metadata?.avatar_url || undefined,
      },
    })

    // If a specific room is requested, grant full access; otherwise allow the
    // session to enter any room the client asks for (Liveblocks will validate
    // room access server-side per the project's ACL settings).
    if (room && typeof room === 'string') {
      session.allow(room, session.FULL_ACCESS)
    } else {
      session.allow('*', session.FULL_ACCESS)
    }

    const { status, body } = await session.authorize()
    const parsed = typeof body === 'string' ? JSON.parse(body) : body
    return res.status(status).json(parsed)
  } catch (error) {
    console.error('[ERROR] Liveblocks auth failed:', error.message)
    return res.status(500).json({
      error: 'Liveblocks auth failed',
      detail: error.message,
    })
  }
})

// Logging middleware
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    console.log(`[DEBUG] Received AI request:`, {
      prompt: req.body.prompt,
      modelId: req.body.modelId,
      type: req.body.type
    })
  }
  next()
})

// Map our UI model ids to provider + real API model name
function resolveProvider(modelId = '') {
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

// ── OpenAI ─────────────────────────────────────────────────
async function callOpenAI(prompt, modelId, apiKey, type) {
  let model = 'gpt-4o'
  if (modelId.includes('gpt-4o-mini')) model = 'gpt-4o-mini'
  else if (modelId.includes('gpt-4o')) model = 'gpt-4o'
  else if (modelId.includes('gpt-4')) model = 'gpt-4'
  else if (modelId.includes('gpt-3.5')) model = 'gpt-3.5-turbo'

  const url = 'https://api.openai.com/v1/chat/completions'
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
  }
  if (type === 'structured') {
    body.response_format = { type: 'json_object' }
    body.messages[0].content = prompt + '\n\nReturn ONLY a valid JSON object. No markdown, no explanation.'
  }

  const res = await axios.post(url, body, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  })
  const text = res.data.choices?.[0]?.message?.content

  if (type === 'structured') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) return { schema: JSON.parse(jsonMatch[0]), provider: 'openai', modelId }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'openai', modelId }
  }
  return { text, provider: 'openai', modelId }
}

// ── Anthropic ──────────────────────────────────────────────
async function callAnthropic(prompt, modelId, apiKey, type) {
  let model = 'claude-3-5-sonnet-latest'
  if (modelId.includes('claude-3-opus')) model = 'claude-3-opus-latest'
  else if (modelId.includes('claude-3-haiku')) model = 'claude-3-haiku-20240307'
  else if (modelId.includes('claude-3-5-haiku')) model = 'claude-3-5-haiku-latest'
  else if (modelId.includes('claude-4')) model = 'claude-3-5-sonnet-latest'

  const url = 'https://api.anthropic.com/v1/messages'
  const body = {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    ...(type === 'structured' ? { system: 'Return ONLY a valid JSON object with keys: type, title, data, model. No markdown, no explanation.' } : {}),
  }

  const res = await axios.post(url, body, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
  })
  const text = res.data.content?.[0]?.text

  if (type === 'structured') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) return { schema: JSON.parse(jsonMatch[0]), provider: 'anthropic', modelId }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'anthropic', modelId }
  }
  return { text, provider: 'anthropic', modelId }
}

// ── Google Gemini ─────────────────────────────────────────
async function callGoogleGemini(prompt, modelId, apiKey, type) {
  let modelName = 'gemini-2.0-flash'
  if (modelId.includes('gemini-2.5-pro') || (modelId.includes('gemini-pro') && !modelId.includes('flash'))) modelName = 'gemini-2.5-pro'
  else if (modelId.includes('gemini-2.5-flash-image')) modelName = 'gemini-2.5-flash-image'
  else if (modelId.includes('gemini-2.5-flash')) modelName = 'gemini-2.5-flash'
  else if (modelId.includes('gemini-2.0-flash')) modelName = 'gemini-2.0-flash'
  else if (modelId.includes('gemini-2.0-pro')) modelName = 'gemini-2.0-pro'
  else if (modelId.includes('gemini-pro')) modelName = 'gemini-2.5-pro'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
  }
  if (type === 'structured') {
    requestBody.systemInstruction = {
      parts: [{ text: 'You are a data visualization assistant. Return ONLY a valid JSON object with exactly these keys: type (one of: bar, line, pie, table), title (short string), data (array of objects each with label and value keys). No markdown, no code blocks, no explanation.' }]
    }
    requestBody.generationConfig = {
      ...requestBody.generationConfig,
      responseMimeType: 'application/json'
    }
  }

  const res = await axios.post(url, requestBody, { headers: { 'Content-Type': 'application/json' } })
  const data = res.data || {}
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text
    || data.message
    || 'No response generated'

  // For structured requests, don't try to unwrap — return raw JSON
  if (type === 'structured') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.type && parsed.data) return { schema: parsed, provider: 'google', modelId }
      }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'google', modelId }
  }

  // For text responses, unwrap if the model returned a JSON wrapper
  if (typeof text === 'string') {
    const trimmed = text.trim()
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const preferredKeys = ['message', 'text', 'response', 'content', 'reply', 'answer', 'output']
          for (const key of preferredKeys) {
            if (parsed[key] && typeof parsed[key] === 'string') { text = parsed[key]; break }
          }
          if (text === trimmed) {
            const firstString = Object.values(parsed).find(v => typeof v === 'string')
            if (firstString) text = firstString
          }
        }
      } catch { /* ignore */ }
    }
  }

  return { text, provider: 'google', modelId }
}

// ── OpenRouter ────────────────────────────────────────────
async function callOpenRouter(prompt, modelId, apiKey, type) {
  let actualModel = modelId.replace(/^openrouter\//, '')

  const messages = type === 'structured'
    ? [
        { role: 'system', content: 'You are a data visualization assistant. Return ONLY a valid JSON object with keys: type (bar|line|pie|table), title (string), data (array of {label, value}). No markdown, no explanation.' },
        { role: 'user', content: prompt }
      ]
    : [{ role: 'user', content: prompt }]

  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: actualModel,
    messages,
    temperature: type === 'structured' ? 0.1 : 0.7,
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://zac-ai.netlify.app',
      'X-Title': 'Zac-AI-Dashboard'
    }
  })

  const text = response.data.choices[0].message.content
  if (type === 'structured') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.type && parsed.data) return { schema: parsed, provider: 'openrouter', modelId }
      }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'openrouter', modelId }
  }
  return { text, provider: 'openrouter', modelId }
}

// ── Error classification ─────────────────────────────────
function classifyError(error, provider) {
  // Errors with no upstream response are local/backend issues (code).
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return { httpStatus: 504, code: 'UPSTREAM_TIMEOUT', kind: 'provider', message: `Upstream ${provider} timed out`, retriable: true }
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EAI_AGAIN') {
      return { httpStatus: 502, code: 'UPSTREAM_UNAVAILABLE', kind: 'provider', message: `Cannot reach ${provider}: ${error.code}`, retriable: true }
    }
    if (/missing .*_api_key/i.test(error.message)) {
      return { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: error.message, retriable: false }
    }
    return { httpStatus: 500, code: 'INTERNAL_ERROR', kind: 'code', message: error.message, retriable: false }
  }

  const status = error.response.status
  const body = error.response.data
  if (status === 401 || status === 403) {
    return { httpStatus: 401, code: 'INVALID_API_KEY', kind: 'code', message: `${provider} rejected the API key (${status})`, providerStatus: status, providerBody: body, retriable: false }
  }
  if (status === 429) {
    return { httpStatus: 429, code: 'RATE_LIMITED', kind: 'provider', message: `${provider} rate limited the request`, providerStatus: status, providerBody: body, retriable: true }
  }
  if (status === 404) {
    return { httpStatus: 404, code: 'MODEL_NOT_FOUND', kind: 'provider', message: `${provider} does not recognise model ${error.config?.modelId || ''}`, providerStatus: status, providerBody: body, retriable: true }
  }
  if (status === 400) {
    return { httpStatus: 400, code: 'BAD_REQUEST', kind: 'provider', message: `${provider} rejected the request as malformed`, providerStatus: status, providerBody: body, retriable: false }
  }
  if (status >= 500) {
    return { httpStatus: 502, code: 'UPSTREAM_UNAVAILABLE', kind: 'provider', message: `${provider} returned ${status}`, providerStatus: status, providerBody: body, retriable: true }
  }
  return { httpStatus: status, code: 'UPSTREAM_ERROR', kind: 'provider', message: `${provider} returned ${status}`, providerStatus: status, providerBody: body, retriable: false }
}

// ── Main AI endpoint ──────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  const { prompt, modelId = 'openrouter/google/gemma-4-26b-a4b-it:free', type = 'text', apiKey: userApiKey } = req.body
  const provider = resolveProvider(modelId)
  console.log(`[DEBUG] Provider: ${provider} | model: ${modelId} | type: ${type} | userKey: ${!!userApiKey}`)

  try {
    let result

    if (provider === 'openai') {
      const key = userApiKey || process.env.OPENAI_API_KEY
      if (!key) throw Object.assign(new Error('Missing OPENAI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENAI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenAI(prompt, modelId, key, type)
    } else if (provider === 'anthropic') {
      const key = userApiKey || process.env.ANTHROPIC_API_KEY
      if (!key) throw Object.assign(new Error('Missing ANTHROPIC_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'ANTHROPIC_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callAnthropic(prompt, modelId, key, type)
    } else if (provider === 'google') {
      const key = userApiKey || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!key) throw Object.assign(new Error('Missing GOOGLE_GEMINI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'GOOGLE_GEMINI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callGoogleGemini(prompt, modelId, key, type)
    } else if (provider === 'openrouter') {
      const key = userApiKey || process.env.OPENROUTER_API_KEY
      console.log('[DEBUG] OpenRouter key present:', !!key, 'length:', key?.length)
      if (!key) throw Object.assign(new Error('Missing OPENROUTER_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENROUTER_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenRouter(prompt, modelId, key, type)
    } else {
      throw Object.assign(new Error(`Unsupported provider: ${provider}`), { _classified: { httpStatus: 400, code: 'UNSUPPORTED_PROVIDER', kind: 'code', message: `Unsupported provider for model ${modelId}` } })
    }

    res.json(result)
  } catch (error) {
    const classified = error._classified || classifyError(error, provider)
    console.error('[ERROR] AI API error:', classified.code, '-', classified.message)
    if (classified.providerBody) {
      console.error('[ERROR] Provider response:', JSON.stringify(classified.providerBody).slice(0, 500))
    }
    res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.code,
      kind: classified.kind,
      provider,
      modelId,
      retriable: classified.retriable,
      providerStatus: classified.providerStatus || null,
      detail: classified.providerBody || null,
    })
  }
})

app.get('/api/image', async (req, res) => {
  const prompt = (req.query.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  const encoded = encodeURIComponent(prompt)

  try {
    const hfKey = process.env.HUGGING_FACE_API_KEY || process.env.HF_API_KEY
    if (hfKey) {
      const model = 'stabilityai/stable-diffusion-xl-base-1.0'
      const hfUrl = `https://api-inference.huggingface.co/models/${model}`
      const hfRes = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      })

      if (hfRes.ok) {
        const buffer = await hfRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const imageUrl = `data:image/jpeg;base64,${base64}`
        return res.json({ imageUrl, provider: 'huggingface', modelId: model })
      }

      console.warn('[WARN] HF image generation failed:', hfRes.status, await hfRes.text())
    }
  } catch (error) {
    console.warn('[WARN] HF image generation error:', error.message)
  }

  const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?model=flux&nologo=true`
  res.json({ imageUrl, provider: 'pollinations', modelId: 'pollinations/free-image' })
})

app.get('/api/proxy-image', async (req, res) => {
  const url = (req.query.url || '').trim()
  if (!url) return res.status(400).json({ error: 'Missing url' })

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream responded with ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'attachment')

    if (upstream.body) {
      const reader = upstream.body.getReader()
      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            res.end()
            return
          }
          res.write(Buffer.from(value.buffer), (err) => {
            if (err) return res.end()
            pump()
          })
        }).catch(() => res.end())
      }
      pump()
    } else {
      res.end()
    }
  } catch (error) {
    console.error('[ERROR] Image proxy failed:', error.message)
    res.status(500).json({ error: 'Image proxy failed', detail: error.message })
  }
})

app.get('/api/dashboard', async (req, res) => {
  const userId = req.query.userId
  if (!userId) return res.status(400).json({ error: 'userId is required' })

  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured on backend' })
    }

    const { data: aiModels, error: modelsError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('user_id', userId)

    if (modelsError) throw modelsError

    const { data: analytics, error: analyticsError } = await supabase
      .from('analytics_data')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (analyticsError) throw analyticsError

    const totalApiRequests = (aiModels || []).reduce((sum, model) => sum + (model.api_requests || 0), 0)
    const totalTokensProcessed = (aiModels || []).reduce((sum, model) => sum + (model.tokens_processed || 0), 0)
    const totalCost = (aiModels || []).reduce((sum, model) => sum + (model.cost || 0), 0)
    const activeModels = (aiModels || []).filter(m => m.status === 'active').length

    res.json({
      metrics: {
        totalApiRequests,
        totalTokensProcessed,
        totalCost,
        activeModels,
        apiRequestChange: 0,
        tokensChange: 0,
        costChange: 0,
        modelChange: 0,
      },
      aiModels: aiModels || [],
      analytics: analytics || [],
    })
  } catch (error) {
    console.error('[ERROR] Dashboard API error:', error.message)
    res.status(500).json({ error: 'Dashboard fetch failed', detail: error.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ai-proxy] listening on port ${PORT}`)
})
