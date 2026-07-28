import express from 'express'
import cors from 'cors'
import axios from 'axios'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || process.env.AI_PROXY_PORT || 8787

const allowedOrigins = [
  'https://zac-ai.netlify.app',
  'http://localhost:5173',
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
    }
  });
});

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
    ...(type === 'structured' ? { response_format: { type: 'json_object' } } : {}),
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
    ...(type === 'structured' ? { response_format: { type: 'json_object' } } : {}),
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
  let modelName = 'gemini-2.5-flash'
  if (modelId.includes('gemini-pro') && !modelId.includes('flash')) modelName = 'gemini-2.5-pro'
  else if (modelId.includes('gemini-2.5-flash-image')) modelName = 'gemini-2.5-flash-image'
  else if (modelId.includes('gemini-2.5-flash')) modelName = 'gemini-2.5-flash'
  else if (modelId.includes('gemini-2.5-pro')) modelName = 'gemini-2.5-pro'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
  }
  if (type === 'structured') {
    requestBody.systemInstruction = {
      parts: [{ text: 'Return ONLY a valid JSON object with keys: type, title, data, model. No markdown.' }]
    }
  }

  const res = await axios.post(url, requestBody, { headers: { 'Content-Type': 'application/json' } })
  const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'

  if (type === 'structured') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) return { schema: JSON.parse(jsonMatch[0]), provider: 'google', modelId }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'google', modelId }
  }
  return { text, provider: 'google', modelId }
}

// ── OpenRouter ────────────────────────────────────────────
async function callOpenRouter(prompt, modelId, apiKey, type) {
  let actualModel = modelId.replace(/^openrouter\//, '')

  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: actualModel,
    messages: [{ role: 'user', content: prompt }],
    ...(type === 'structured' ? { response_format: { type: 'json_object' }, temperature: 0.1 } : {}),
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
      if (jsonMatch) return { schema: JSON.parse(jsonMatch[0]), provider: 'openrouter', modelId }
    } catch { /* ignore parse error */ }
    return { schema: { type: 'text', title: prompt.slice(0, 40), content: text, model: modelId }, provider: 'openrouter', modelId }
  }
  return { text, provider: 'openrouter', modelId }
}

// ── Main AI endpoint ──────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, modelId = 'openrouter/google/gemma-4-26b-a4b-it:free', type = 'text' } = req.body
    const provider = resolveProvider(modelId)
    console.log(`[DEBUG] Provider: ${provider} | model: ${modelId} | type: ${type}`)

    let result

    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')
      result = await callOpenAI(prompt, modelId, process.env.OPENAI_API_KEY, type)
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY')
      result = await callAnthropic(prompt, modelId, process.env.ANTHROPIC_API_KEY, type)
    } else if (provider === 'google') {
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('Missing GOOGLE_GEMINI_API_KEY')
      result = await callGoogleGemini(prompt, modelId, apiKey, type)
    } else if (provider === 'openrouter') {
      if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY')
      result = await callOpenRouter(prompt, modelId, process.env.OPENROUTER_API_KEY, type)
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    res.json(result)
  } catch (error) {
    console.error('[ERROR] AI API error:', error.message, error.response?.data)
    res.status(500).json({ error: 'AI provider request failed', detail: error.response?.data || error.message })
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

app.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}`)
})
