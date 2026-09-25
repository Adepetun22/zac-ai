import express from 'express'
import cors from 'cors'
import axios from 'axios'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { Liveblocks } from '@liveblocks/node'
import nodemailer from 'nodemailer'

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
  const hasSupabase = !!supabase
  console.log('[DEBUG] Liveblocks auth header present:', !!authHeader, 'token present:', !!token, 'token length:', token?.length, 'supabase configured:', hasSupabase)

  if (!token || !supabase) {
    const reason = !token ? 'no token' : 'supabase not configured on server'
    console.log('[DEBUG] Liveblocks auth rejecting:', reason)
    return res.status(401).json({
      error: 'forbidden',
      reason: 'Missing or invalid auth token. Sign in first.',
    })
  }

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    console.log('[DEBUG] Liveblocks supabase getUser:', !!user, 'userErr:', userErr?.message)
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
      type: req.body.type,
      historyCount: req.body.messages?.length || 0
    })
  }
  next()
})

// ── History helpers ─────────────────────────────────────────
// Build an OpenAI/Anthropic/OpenRouter-compatible messages array from prior
// conversation history + the current prompt. Falls back to a single user
// message when no history is supplied (preserves old behaviour).
function buildHistory(historyMessages, prompt, systemInstruction = null) {
  const messages = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  if (Array.isArray(historyMessages) && historyMessages.length > 0) {
    for (const m of historyMessages) {
      if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
        messages.push({ role: m.role, content: m.content })
      }
    }
  }
  messages.push({ role: 'user', content: prompt })
  return messages
}

// Build a Gemini contents array (role → 'user' / 'model').
function buildGeminiContents(historyMessages, prompt) {
  const contents = []
  if (Array.isArray(historyMessages) && historyMessages.length > 0) {
    for (const m of historyMessages) {
      if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })
      }
    }
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })
  return contents
}

// ── Tool Registry ─────────────────────────────────────────────────────────────
// Each tool has: name, description, parameters (JSON-schema-ish), and an execute function.
// Tools return { type, ... } where type is one of: 'widget', 'text', 'action'.
//   - 'widget'  → { type: 'widget', schema }  (adds a widget to the canvas)
//   - 'text'    → { type: 'text', content }
//   - 'action'  → { type: 'action', message, data }  (side-effect performed, e.g. email sent)

const tools = {
  create_spreadsheet: {
    name: 'create_spreadsheet',
    description: 'Create an interactive spreadsheet widget with rows and columns of data. Use when user asks for a spreadsheet, table of data, or data grid.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the spreadsheet' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
        rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Row data, each row matching columns' },
      },
      required: ['title', 'columns', 'rows'],
    },
    execute: (args) => {
      const { title, columns, rows } = args
      return {
        type: 'widget',
        schema: {
          type: 'spreadsheet',
          title: title || 'Spreadsheet',
          columns: Array.isArray(columns) ? columns : [],
          rows: Array.isArray(rows) ? rows : [],
          model: 'tool',
        },
      }
    },
  },

  create_chart: {
    name: 'create_chart',
    description: 'Create a bar, line, or pie chart widget. Use when user asks to visualize data.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['bar', 'line', 'pie'], description: 'Chart type' },
        title: { type: 'string', description: 'Chart title' },
        data: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } } }, description: 'Data points' },
      },
      required: ['kind', 'title', 'data'],
    },
    execute: (args) => {
      const { kind, title, data } = args
      return {
        type: 'widget',
        schema: {
          type: kind,
          title: title || 'Chart',
          data: Array.isArray(data) ? data : [],
          model: 'tool',
        },
      }
    },
  },

  send_email: {
    name: 'send_email',
    description: 'Send an email to a recipient. Use when user asks to email, send a message, or notify someone.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text)' },
      },
      required: ['to', 'subject', 'body'],
    },
    execute: async (args) => {
      const { to, subject, body } = args
      const smtpHost = process.env.SMTP_HOST
      const smtpPort = process.env.SMTP_PORT || 587
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS
      const smtpFrom = process.env.SMTP_FROM || smtpUser

      if (!smtpHost || !smtpUser || !smtpPass) {
        return {
          type: 'action',
          message: `Email not sent — SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS on the server.`,
          data: { sent: false, to, subject },
        }
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })
        const info = await transporter.sendMail({
          from: smtpFrom,
          to,
          subject,
          text: body,
        })
        return {
          type: 'action',
          message: `Email sent to ${to} (messageId: ${info.messageId})`,
          data: { sent: true, to, subject, messageId: info.messageId },
        }
      } catch (err) {
        return {
          type: 'action',
          message: `Email failed: ${err.message}`,
          data: { sent: false, to, subject, error: err.message },
        }
      }
    },
  },

  create_calendar_event: {
    name: 'create_calendar_event',
    description: 'Create a calendar event. Use when user asks to schedule a meeting, add to calendar, or set a reminder.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        start: { type: 'string', description: 'ISO 8601 start datetime, e.g. 2026-09-14T10:00:00Z' },
        end: { type: 'string', description: 'ISO 8601 end datetime, e.g. 2026-09-14T11:00:00Z' },
        location: { type: 'string', description: 'Optional location' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['summary', 'start', 'end'],
    },
    execute: async (args) => {
      const { summary, start, end, location, description } = args
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Zac-AI-Dashboard//EN',
        'BEGIN:VEVENT',
        `SUMMARY:${summary}`,
        `DTSTART:${start.replace(/[-:]/g, '').replace('T', 'T')}`,
        `DTEND:${end.replace(/[-:]/g, '').replace('T', 'T')}`,
        location ? `LOCATION:${location}` : '',
        description ? `DESCRIPTION:${description}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
      ].filter(Boolean).join('\r\n')

      return {
        type: 'action',
        message: `Calendar event "${summary}" created for ${start} → ${end}.`,
        data: {
          summary,
          start,
          end,
          location: location || null,
          description: description || null,
          ics: icsContent,
        },
      }
    },
  },
}

// ── Tool execution ────────────────────────────────────────────────────────────
// Given a tool call from the LLM, look up the tool and run it.
async function executeToolCall(toolCall) {
  const toolName = toolCall.function?.name || toolCall.name
  let args = {}
  try {
    args = typeof toolCall.function?.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : (toolCall.arguments || {})
  } catch {
    args = {}
  }
  const tool = tools[toolName]
  if (!tool) {
    return { type: 'error', message: `Unknown tool: ${toolName}` }
  }
  try {
    const result = await tool.execute(args)
    return result
  } catch (err) {
    return { type: 'error', message: `Tool ${toolName} failed: ${err.message}` }
  }
}

// Build the tools array for providers that support it (OpenAI/OpenRouter).
function getToolDefinitions() {
  return Object.values(tools).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

// Build Gemini-style function declarations.
function getGeminiFunctionDeclarations() {
  return Object.values(tools).map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties || {}).map(([k, v]) => [k, { type: v.type?.toUpperCase() || 'STRING', description: v.description }])
      ),
      required: t.parameters.required || [],
    },
  }))
}

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
async function callOpenAI(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto') {
  let model = 'gpt-4o'
  if (modelId.includes('gpt-4o-mini')) model = 'gpt-4o-mini'
  else if (modelId.includes('gpt-4o')) model = 'gpt-4o'
  else if (modelId.includes('gpt-4')) model = 'gpt-4'
  else if (modelId.includes('gpt-3.5')) model = 'gpt-3.5-turbo'

  const url = 'https://api.openai.com/v1/chat/completions'
  const messages = buildHistory(historyMessages, prompt, type === 'structured' ? 'Return ONLY a valid JSON object. No markdown, no explanation.' : null)
  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  }
  if (type === 'structured') {
    body.response_format = { type: 'json_object' }
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice
  }

  const res = await axios.post(url, body, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  })
  const choice = res.data.choices?.[0]
  const message = choice?.message

  // Handle tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolResults = []
    for (const tc of message.tool_calls) {
      const result = await executeToolCall(tc)
      toolResults.push({
        tool_call_id: tc.id,
        role: 'tool',
        content: JSON.stringify(result),
      })
    }
    // Send tool results back to the model for a final response
    const followUpMessages = [
      ...messages,
      message,
      ...toolResults,
    ]
    const followUpBody = {
      model,
      messages: followUpMessages,
      temperature: 0.7,
      max_tokens: 1000,
    }
    const followUpRes = await axios.post(url, followUpBody, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    })
    const finalText = followUpRes.data.choices?.[0]?.message?.content
    return { text: finalText, provider: 'openai', modelId, toolResults }
  }

  const text = message?.content

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
async function callAnthropic(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto') {
  let model = 'claude-3-5-sonnet-latest'
  if (modelId.includes('claude-3-opus')) model = 'claude-3-opus-latest'
  else if (modelId.includes('claude-3-haiku')) model = 'claude-3-haiku-20240307'
  else if (modelId.includes('claude-3-5-haiku')) model = 'claude-3-5-haiku-latest'
  else if (modelId.includes('claude-4')) model = 'claude-3-5-sonnet-latest'

  const url = 'https://api.anthropic.com/v1/messages'
  const messages = buildHistory(historyMessages, prompt, type === 'structured' ? 'Return ONLY a valid JSON object with keys: type, title, data, model. No markdown, no explanation.' : null)
  const body = {
    model,
    max_tokens: 1024,
    messages,
    ...(type === 'structured' ? { system: 'Return ONLY a valid JSON object with keys: type, title, data, model. No markdown, no explanation.' } : {}),
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice === 'required' ? { type: 'tool', name: toolChoice.name } : { type: 'auto' }
  }

  const res = await axios.post(url, body, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
  })
  const content = res.data.content || []

  // Handle tool use blocks
  const toolUseBlocks = content.filter(b => b.type === 'tool_use')
  if (toolUseBlocks.length > 0) {
    const toolResults = []
    for (const block of toolUseBlocks) {
      const result = await executeToolCall({ name: block.name, arguments: block.input })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      })
    }
    // Send tool results back to Claude for a final response
    const followUpMessages = [
      ...messages,
      { role: 'assistant', content },
      { role: 'user', content: toolResults },
    ]
    const followUpBody = {
      model,
      max_tokens: 1024,
      messages: followUpMessages,
      ...(type === 'structured' ? { system: 'Return ONLY a valid JSON object with keys: type, title, data, model. No markdown, no explanation.' } : {}),
    }
    const followUpRes = await axios.post(url, followUpBody, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      }
    })
    const finalContent = followUpRes.data.content || []
    const finalText = finalContent.filter(b => b.type === 'text').map(b => b.text).join('') || 'Done.'
    return { text: finalText, provider: 'anthropic', modelId, toolResults }
  }

  const text = content.filter(b => b.type === 'text').map(b => b.text).join('') || res.data.content?.[0]?.text

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
async function callGoogleGemini(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto') {
  let modelName = 'gemini-2.0-flash'
  if (modelId.includes('gemini-2.5-pro') || (modelId.includes('gemini-pro') && !modelId.includes('flash'))) modelName = 'gemini-2.5-pro'
  else if (modelId.includes('gemini-2.5-flash-image')) modelName = 'gemini-2.5-flash-image'
  else if (modelId.includes('gemini-2.5-flash')) modelName = 'gemini-2.5-flash'
  else if (modelId.includes('gemini-2.0-flash')) modelName = 'gemini-2.0-flash'
  else if (modelId.includes('gemini-2.0-pro')) modelName = 'gemini-2.0-pro'
  else if (modelId.includes('gemini-pro')) modelName = 'gemini-2.5-pro'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
  const contents = buildGeminiContents(historyMessages, prompt)
  const requestBody = {
    contents,
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
  if (tools && tools.length > 0) {
    requestBody.tools = [{ functionDeclarations: tools }]
  }

  const res = await axios.post(url, requestBody, { headers: { 'Content-Type': 'application/json' } })
  const data = res.data || {}
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts || []

  // Handle function calls
  const functionCallParts = parts.filter(p => p.functionCall)
  if (functionCallParts.length > 0) {
    const toolResults = []
    for (const part of functionCallParts) {
      const fc = part.functionCall
      const result = await executeToolCall({ name: fc.name, arguments: fc.args })
      toolResults.push({
        role: 'function',
        parts: [{ functionResponse: { name: fc.name, response: result } }],
      })
    }
    // Send tool results back to Gemini
    const followUpBody = {
      contents: [...contents, candidate.content, ...toolResults],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
    }
    if (type === 'structured') {
      followUpBody.systemInstruction = {
        parts: [{ text: 'You are a data visualization assistant. Return ONLY a valid JSON object with exactly these keys: type (one of: bar, line, pie, table), title (short string), data (array of objects each with label and value keys). No markdown, no code blocks, no explanation.' }]
      }
      followUpBody.generationConfig = {
        ...followUpBody.generationConfig,
        responseMimeType: 'application/json'
      }
    }
    if (tools && tools.length > 0) {
      followUpBody.tools = [{ functionDeclarations: tools }]
    }
    const followUpRes = await axios.post(url, followUpBody, { headers: { 'Content-Type': 'application/json' } })
    const followUpData = followUpRes.data || {}
    let text = followUpData.candidates?.[0]?.content?.parts?.[0]?.text
      || followUpData.message
      || 'Done.'

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

    return { text, provider: 'google', modelId, toolResults }
  }

  let text = parts.find(p => p.text)?.text
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
async function callOpenRouter(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto') {
  let actualModel = modelId.replace(/^openrouter\//, '')

  const messages = buildHistory(historyMessages, prompt, type === 'structured' ? 'You are a data visualization assistant. Return ONLY a valid JSON object with keys: type (bar|line|pie|table), title (string), data (array of {label, value}). No markdown, no explanation.' : null)

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://zac-ai.netlify.app',
    'X-Title': 'Zac-AI-Dashboard'
  }
  console.log('[DEBUG] OpenRouter request headers:', {
    ...headers,
    Authorization: headers.Authorization ? `${headers.Authorization.slice(0, 15)}...` : undefined
  })

  const body = {
    model: actualModel,
    messages,
    temperature: type === 'structured' ? 0.1 : 0.7,
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice
  }

  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
    headers,
    maxRedirects: 0
  })

  console.log('[DEBUG] OpenRouter response status:', response.status)
  console.log('[DEBUG] OpenRouter response headers:', response.headers)

  const choice = response.data.choices?.[0]
  const message = choice?.message

  // Handle tool calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolResults = []
    for (const tc of message.tool_calls) {
      const result = await executeToolCall(tc)
      toolResults.push({
        tool_call_id: tc.id,
        role: 'tool',
        content: JSON.stringify(result),
      })
    }
    const followUpBody = {
      model: actualModel,
      messages: [...messages, message, ...toolResults],
      temperature: type === 'structured' ? 0.1 : 0.7,
    }
    const followUpRes = await axios.post('https://openrouter.ai/api/v1/chat/completions', followUpBody, {
      headers,
      maxRedirects: 0
    })
    const finalText = followUpRes.data.choices?.[0]?.message?.content
    return { text: finalText, provider: 'openrouter', modelId, toolResults }
  }

  const text = message?.content
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
  const { prompt, modelId = 'openrouter/google/gemma-4-26b-a4b-it:free', type = 'text', apiKey: userApiKey, messages: historyMessages, tools: requestedTools, toolChoice } = req.body
  const provider = resolveProvider(modelId)
  console.log(`[DEBUG] Provider: ${provider} | model: ${modelId} | type: ${type} | userKey: ${!!userApiKey} | history: ${historyMessages?.length || 0} | tools: ${requestedTools?.length || 0}`)

  // Build the actual tools array based on what the client requested.
  // Only allow tools that are registered on the server (security: we don't
  // let the client inject arbitrary tool definitions).
  let toolDefs = null
  if (requestedTools && requestedTools.length > 0) {
    const allDefs = (provider === 'google' ? getGeminiFunctionDeclarations() : getToolDefinitions())
    const wantedNames = new Set(requestedTools.map(t => (typeof t === 'string' ? t : t.name)))
    toolDefs = allDefs.filter(d => wantedNames.has(d.name))
  }

  try {
    let result

    if (provider === 'openai') {
      const key = userApiKey || process.env.OPENAI_API_KEY
      if (!key) throw Object.assign(new Error('Missing OPENAI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENAI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenAI(prompt, modelId, key, type, historyMessages, toolDefs, toolChoice)
    } else if (provider === 'anthropic') {
      const key = userApiKey || process.env.ANTHROPIC_API_KEY
      if (!key) throw Object.assign(new Error('Missing ANTHROPIC_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'ANTHROPIC_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callAnthropic(prompt, modelId, key, type, historyMessages, toolDefs, toolChoice)
    } else if (provider === 'google') {
      const key = userApiKey || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!key) throw Object.assign(new Error('Missing GOOGLE_GEMINI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'GOOGLE_GEMINI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callGoogleGemini(prompt, modelId, key, type, historyMessages, toolDefs, toolChoice)
    } else if (provider === 'openrouter') {
      const key = userApiKey || process.env.OPENROUTER_API_KEY
      console.log('[DEBUG] OpenRouter key present:', !!key, 'length:', key?.length)
      if (!key) throw Object.assign(new Error('Missing OPENROUTER_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENROUTER_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenRouter(prompt, modelId, key, type, historyMessages, toolDefs, toolChoice)
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
