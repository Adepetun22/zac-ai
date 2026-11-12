import express from 'express'
import cors from 'cors'
import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { Liveblocks } from '@liveblocks/node'
import nodemailer from 'nodemailer'
import {
  createConcurrencyLimiter,
  createRateLimiter,
  fetchAllowedImage,
} from './security.js'
import { shutdownRedis } from './redis.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || process.env.AI_PROXY_PORT || 8787

app.disable('x-powered-by')
app.set('trust proxy', 1)

const allowedOrigins = [
  'https://zac-ai.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
]
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)), credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ limit: '2mb', extended: true }))

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

// ── Supabase admin client ──────────────────────────────────────
// Uses the SERVICE_ROLE_KEY (secret) so auth credentials never pass through the
// browser. The anon-key client above is retained for data/proxy endpoints that
// don't need admin privileges. The admin client disables auto-refresh and
// persistence because it is request-scoped (no long-lived session).
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Origin of the deployed frontend — used to build redirect URLs for email
// confirmations and password-reset links.
const frontendUrl = process.env.FRONTEND_URL || 'https://zac-ai.netlify.app'

// ── Rate limits ─────────────────────────────────────────────
// In-memory limits protect a single instance. When the service is scaled
// horizontally, move these to a shared Redis store.
const authLimiter = createRateLimiter({ name: 'auth', windowMs: 15 * 60 * 1000, max: 10 })
const aiLimiter = createRateLimiter({
  name: 'ai',
  windowMs: 60 * 1000,
  max: Number(process.env.AI_REQUESTS_PER_MINUTE) || 20,
  keyGenerator: (req) => req.user?.id || req.ip,
})
const modelLimiter = createRateLimiter({ name: 'models', windowMs: 60 * 1000, max: 60 })
const knowledgeLimiter = createRateLimiter({ name: 'knowledge', windowMs: 60 * 1000, max: 30 })
const proxyLimiter = createRateLimiter({ name: 'proxy', windowMs: 60 * 1000, max: 30 })
const imageLimiter = createRateLimiter({ name: 'image', windowMs: 60 * 1000, max: 10 })
const liveblocksLimiter = createRateLimiter({ name: 'liveblocks', windowMs: 60 * 1000, max: 60 })

const aiConcurrency = createConcurrencyLimiter({
  name: 'ai',
  globalMax: Number(process.env.AI_MAX_CONCURRENT) || 200,
  perUserMax: Number(process.env.AI_MAX_CONCURRENT_PER_USER) || 3,
})

// Verify a Supabase access token locally when the project uses asymmetric JWT
// signing keys. getClaims() caches the JWKS inside the Supabase client.
async function getUserFromToken(token) {
  if (!token || !supabaseAdmin) return null

  try {
    if (typeof supabaseAdmin.auth.getClaims === 'function') {
      const { data, error } = await supabaseAdmin.auth.getClaims(token)

      if (error || !data?.claims?.sub) return null

      return {
        id: data.claims.sub,
        email: data.claims.email,
        user_metadata: data.claims.user_metadata || {},
        app_metadata: data.claims.app_metadata || {},
      }
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

async function requireUser(req, res, next) {
  const token = extractBearerToken(req)

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const user = await getUserFromToken(token)

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = user
  return next()
}

async function assertSessionParticipant(sessionId, userId) {
  if (!sessionId || !userId) return false

  const { data, error } = await supabaseAdmin
    .from('session_participants')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[WARN] Session membership check failed:', error.message)
    return false
  }

  return !!data
}

// ── API Key encryption ─────────────────────────────────────────
// User-supplied LLM API keys are encrypted at rest in Supabase using AES-256-GCM.
// The encryption key must be a 32-byte hex string set as API_KEY_ENCRYPTION_KEY
// in the Render dashboard (sync: false). Never VITE_-prefixed.
const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY

function encryptApiKey(plaintext) {
  if (!plaintext || !encryptionKey) {
    // If no encryption key is configured, fall back to base64 encoding
    // (still opaque, and the server is the only consumer that base64-decodes).
    // This keeps the system functional in local dev without breaking.
    return plaintext ? Buffer.from(plaintext, 'utf8').toString('base64') + ':b64' : null
  }
  const key = Buffer.from(encryptionKey, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from('zac-ai', 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decryptApiKey(stored) {
  if (!stored) return null
  try {
    if (stored.endsWith(':b64')) {
      // Legacy base64-encoded key (no encryption key configured).
      return Buffer.from(stored.slice(0, -4), 'base64').toString('utf8')
    }
    if (!encryptionKey) {
      console.warn('[WARN] Cannot decrypt API key: API_KEY_ENCRYPTION_KEY is not set.')
      return null
    }
    const key = Buffer.from(encryptionKey, 'hex')
    const data = Buffer.from(stored, 'base64url')
    const iv = data.subarray(0, 12)
    const tag = data.subarray(12, 28)
    const encrypted = data.subarray(28)
    const decipher = crypto.createDecipherGCM('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from('zac-ai', 'utf8'))
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err) {
    console.error('[ERROR] Failed to decrypt API key:', err.message)
    return null
  }
}

// Return a masked version of an API key for display (e.g. "sk-…⋯…XYZ").
function maskApiKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  const first = key.slice(0, 4)
  const last = key.slice(-4)
  return `${first}••••${last}`
}

// Look up a user's registered model and decrypt its API key.
// Returns { api_key: decryptedKey|null, provider: string } or null if not found.
async function lookupUserModelKey(userId, modelId) {
  if (!supabaseAdmin || !userId || !modelId) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .select('api_key, provider')
      .eq('user_id', userId)
      .eq('model_id', modelId.replace(/^openrouter\//, ''))
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) {
      // Also try with the full model_id (including provider prefix)
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('ai_models')
        .select('api_key, provider')
        .eq('user_id', userId)
        .eq('model_id', modelId)
        .eq('status', 'active')
        .maybeSingle()

      if (error2 || !data2) return null
      return { provider: data2.provider, api_key: decryptApiKey(data2.api_key) }
    }
    return { provider: data.provider, api_key: decryptApiKey(data.api_key) }
  } catch (err) {
    console.warn('[WARN] Error looking up user model key:', err.message)
    return null
  }
}

// ── Auth proxy helpers ─────────────────────────────────────────
// Translate the camelCase/flat shape the frontend sends into the
// user_metadata / app_metadata blocks the Supabase admin API expects.
function translateUserUpdates(updates) {
  const attrs = {}
  if (updates.email) attrs.email = updates.email
  if (updates.password) attrs.password = updates.password
  if (updates.data) {
    attrs.user_metadata = updates.data
  }
  if (updates.app_metadata) {
    attrs.app_metadata = updates.app_metadata
  }
  return attrs
}

// Extract the Bearer token from the Authorization header.
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
}

// Verify an access token via the admin client and return the user (or null).
async function verifyAccessToken(token) {
  return getUserFromToken(token)
}

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

// ── Auth proxy endpoints ───────────────────────────────────────
// All credential-based auth operations (signIn, signUp, signOut, password
// reset, user updates) are proxied through the backend so the browser
// never talks to Supabase directly for auth. The supabaseAdmin client
// (service-role key) performs the actual operation and the resulting
// session is returned to the frontend, which calls supabase.auth.setSession()
// to restore the client-side Supabase client for data/subscription use.

app.use('/api/auth', (req, res, next) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Auth service not configured on backend' })
  }
  next()
})

// POST /api/auth/signin — exchange email/password for a session via the admin client
app.post('/api/auth/signin', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ user: data.user, session: data.session })
  } catch (err) {
    console.error('[ERROR] Auth signin failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/signup — create a new user account
app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  try {
    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: name ? { name } : undefined,
        emailRedirectTo: `${frontendUrl}/login`,
      },
    })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ user: data.user, session: data.session })
  } catch (err) {
    console.error('[ERROR] Auth signup failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/signout — acknowledge sign-out request.
// The client-side supabase.auth.signOut() handles token revocation; this
// endpoint exists so the backend can perform server-side cleanup if session
// management is ever moved server-side (e.g., cookies / session store).
app.post('/api/auth/signout', async (req, res) => {
  const token = extractBearerToken(req) || req.body?.access_token
  if (token && supabaseAdmin) {
    try {
      const user = await verifyAccessToken(token)
      if (user) {
        const signOutUser = supabaseAdmin.auth.admin?.signOutUser
        if (typeof signOutUser === 'function') {
          await signOutUser.call(supabaseAdmin.auth.admin, user.id)
        }
      }
    } catch (err) {
      console.warn('[WARN] Auth signout backend cleanup failed:', err.message)
    }
  }
  res.json({ success: true })
})

// GET /api/auth/session — return the current user from the access token
app.get('/api/auth/session', async (req, res) => {
  const token = extractBearerToken(req)
  if (!token) return res.json({ user: null })
  const user = await verifyAccessToken(token)
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' })
  res.json({ user })
})

// POST /api/auth/reset-password — send a password-reset email
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })
  try {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/reset-password`,
    })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ error: null })
  } catch (err) {
    console.error('[ERROR] Password reset request failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/exchange-code-for-session — exchange a PKCE recovery code
// for a session. The client-side Supabase client normally handles this
// automatically, but in some edge cases (e.g. the code arrives in the URL
// fragment) it can be useful to exchange it here.
app.post('/api/auth/exchange-code-for-session', authLimiter, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Auth code is required' })
  try {
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession({ auth_code: code })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ session: data.session, user: data.user })
  } catch (err) {
    console.error('[ERROR] Code exchange failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/auth/update-password — set a new password (recovery or authenticated)
app.post('/api/auth/update-password', async (req, res) => {
  const { password, access_token } = req.body
  if (!password) return res.status(400).json({ error: 'Password is required' })
  const user = await verifyAccessToken(access_token)
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' })
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUser(user.id, { password })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ error: null })
  } catch (err) {
    console.error('[ERROR] Password update failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/auth/user — update the authenticated user's metadata
app.patch('/api/auth/user', requireUser, async (req, res) => {
  const user = req.user
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUser(user.id, translateUserUpdates(req.body))
    if (error) return res.status(400).json({ error: error.message })
    res.json({ error: null })
  } catch (err) {
    console.error('[ERROR] User update failed:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})
//
// The browser Liveblocks client calls this endpoint to mint a short-lived
// access token for the current user. Without it the WebSocket connection
// fails with "Timed out during websocket connection" because the client
// can't authenticate. Requires LIVEBLOCKS_SECRET_KEY on the server.
const liveblocks = process.env.LIVEBLOCKS_SECRET_KEY
  ? new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY })
  : null

app.post('/api/liveblocks-auth', requireUser, liveblocksLimiter, async (req, res) => {
  if (!liveblocks) {
    return res.status(503).json({
      error: 'Liveblocks not configured on server',
      detail: 'LIVEBLOCKS_SECRET_KEY is missing on the backend. Set it in the Render dashboard.',
    })
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Liveblocks auth is not configured' })
  }

  const { room } = req.body || {}

  if (!room || typeof room !== 'string') {
    return res.status(400).json({ error: 'room is required' })
  }

  try {
    const isParticipant = await assertSessionParticipant(room, req.user.id)

    if (!isParticipant) {
      return res.status(403).json({
        error: 'forbidden',
        reason: 'You are not a participant in this collaboration session.',
      })
    }

    const session = liveblocks.prepareSession(req.user.id, {
      userInfo: {
        name: req.user.user_metadata?.name || req.user.email?.split('@')[0] || 'User',
        avatar: req.user.user_metadata?.avatar_url || undefined,
      },
    })

    session.allow(room, session.FULL_ACCESS)

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
  let args
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
async function callOpenAI(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto', options = {}) {
  const { signal, timeout = 45_000 } = options
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal,
    timeout,
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
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal,
      timeout,
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
async function callAnthropic(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto', options = {}) {
  const { signal, timeout = 45_000 } = options
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
    },
    signal,
    timeout,
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
      },
      signal,
      timeout,
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
async function callGoogleGemini(prompt, modelId, apiKey, type, historyMessages = [], tools = null, _toolChoice = 'auto', options = {}) {
  const { signal, timeout = 45_000 } = options
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

  const res = await axios.post(url, requestBody, {
    headers: { 'Content-Type': 'application/json' },
    signal,
    timeout,
  })
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
    const followUpRes = await axios.post(url, followUpBody, {
      headers: { 'Content-Type': 'application/json' },
      signal,
      timeout,
    })
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

// Retry a function with exponential backoff; retries on 429 / 5xx / network errors.
// Respects the Retry-After header when present.
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3
  const baseDelayMs = options.baseDelayMs || 500
  const signal = options.signal

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        throw err
      }

      const status = err.response?.status
      const is429 = status === 429
      const is5xx = status && status >= 500 && status < 600
      const isNetwork = !err.response && !!err.code

      // Don't retry on the final attempt, or on non-retryable errors.
      if (attempt === maxAttempts || (!is429 && !is5xx && !isNetwork)) {
        throw err
      }

      // Determine wait time: prefer Retry-After header, then exponential backoff.
      let delay = baseDelayMs * Math.pow(2, attempt - 1)
      if (is429) {
        const retryAfter = err.response?.headers?.['retry-after']
        if (retryAfter) {
          const parsed = parseFloat(retryAfter)
          if (!isNaN(parsed)) {
            // If the header is a small number (< 120), treat it as seconds; otherwise treat as a date offset.
            delay = parsed < 120 ? parsed * 1000 : Math.min(parsed, 30000)
          }
        }
      }
      // Add jitter so a fleet of instances does not retry in lockstep.
      delay += Math.floor(Math.random() * 250)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

async function callOpenRouter(prompt, modelId, apiKey, type, historyMessages = [], tools = null, toolChoice = 'auto', options = {}) {
  const actualModel = modelId.replace(/^openrouter\//, '')
  const { signal, timeout = 30_000 } = options

  const messages = buildHistory(historyMessages, prompt, type === 'structured' ? 'You are a data visualization assistant. Return ONLY a valid JSON object with keys: type (bar|line|pie|table), title (string), data (array of {label, value}). No markdown, no explanation.' : null)

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://zac-ai.netlify.app',
    'X-Title': 'Zac-AI-Dashboard'
  }

  const body = {
    model: actualModel,
    messages,
    temperature: type === 'structured' ? 0.1 : 0.7,
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice
  }

  const response = await withRetry(() => axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
    headers,
    maxRedirects: 0,
    timeout,
    signal,
  }), { maxAttempts: 3, baseDelayMs: 1000, signal })

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
    const followUpRes = await withRetry(() => axios.post('https://openrouter.ai/api/v1/chat/completions', followUpBody, {
      headers,
      maxRedirects: 0,
      timeout,
      signal,
    }), { maxAttempts: 3, baseDelayMs: 1000, signal })
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
    if (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.code === 'ECONNABORTED') {
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
app.post('/api/ai', requireUser, aiLimiter, async (req, res) => {
  const {
    prompt,
    modelId = 'openrouter/google/gemma-4-26b-a4b-it:free',
    type = 'text',
    messages: historyMessages,
    tools: requestedTools,
    toolChoice,
  } = req.body

  const userId = req.user.id

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  if (prompt.length > 20_000) {
    return res.status(413).json({ error: 'prompt is too long', code: 'PROMPT_TOO_LONG' })
  }

  if (typeof modelId !== 'string' || modelId.length === 0 || modelId.length > 300) {
    return res.status(400).json({ error: 'modelId must be a string', code: 'INVALID_MODEL' })
  }

  if (!['text', 'structured', 'image'].includes(type)) {
    return res.status(400).json({ error: 'type must be text, structured, or image', code: 'INVALID_TYPE' })
  }

  const provider = resolveProvider(modelId)

  const safeHistory = Array.isArray(historyMessages)
    ? historyMessages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-30)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8_000) }))
    : []

  // ── Resolve the API key ───────────────────────────────────────
  // The client never supplies the raw key. The server looks up the user's
  // encrypted model record, then falls back to the server-level env key for
  // free/shared models.
  let resolvedKey = null

  const lookup = await lookupUserModelKey(userId, modelId)
  if (lookup?.api_key) {
    resolvedKey = lookup.api_key
  }

  let toolDefs = null
  if (Array.isArray(requestedTools) && requestedTools.length > 0) {
    const allDefs = (provider === 'google' ? getGeminiFunctionDeclarations() : getToolDefinitions())
    const wantedNames = new Set(requestedTools.map(t => (typeof t === 'string' ? t : t?.name)))
    toolDefs = allDefs.filter(d => wantedNames.has(d.name))
  }

  let releaseSlot

  try {
    releaseSlot = await aiConcurrency.acquire(req)
  } catch (error) {
    return res.status(error.statusCode || 429).json({
      error: error.message,
      code: error.code || 'AI_CAPACITY',
      kind: 'code',
      retriable: true,
    })
  }

  const controller = new AbortController()
  const requestTimeout = setTimeout(() => controller.abort(), 60_000)
  const abortClientRequest = () => {
    if (!res.writableEnded) controller.abort()
  }

  req.on('aborted', abortClientRequest)
  res.on('close', abortClientRequest)

  try {
    const providerOptions = { signal: controller.signal, timeout: 45_000 }
    let result

    if (provider === 'openai') {
      const key = resolvedKey || process.env.OPENAI_API_KEY
      if (!key) throw Object.assign(new Error('Missing OPENAI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENAI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenAI(prompt, modelId, key, type, safeHistory, toolDefs, toolChoice, providerOptions)
    } else if (provider === 'anthropic') {
      const key = resolvedKey || process.env.ANTHROPIC_API_KEY
      if (!key) throw Object.assign(new Error('Missing ANTHROPIC_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'ANTHROPIC_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callAnthropic(prompt, modelId, key, type, safeHistory, toolDefs, toolChoice, providerOptions)
    } else if (provider === 'google') {
      const key = resolvedKey || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!key) throw Object.assign(new Error('Missing GOOGLE_GEMINI_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'GOOGLE_GEMINI_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callGoogleGemini(prompt, modelId, key, type, safeHistory, toolDefs, toolChoice, providerOptions)
    } else if (provider === 'openrouter') {
      const key = resolvedKey || process.env.OPENROUTER_API_KEY
      if (!key) throw Object.assign(new Error('Missing OPENROUTER_API_KEY on server'), { _classified: { httpStatus: 503, code: 'MISSING_API_KEY', kind: 'code', message: 'OPENROUTER_API_KEY is not configured on the server. Set it in the Render dashboard.' } })
      result = await callOpenRouter(prompt, modelId, key, type, safeHistory, toolDefs, toolChoice, providerOptions)
    } else {
      throw Object.assign(new Error(`Unsupported provider: ${provider}`), { _classified: { httpStatus: 400, code: 'UNSUPPORTED_PROVIDER', kind: 'code', message: `Unsupported provider for model ${modelId}` } })
    }

    if (!res.writableEnded) res.json(result)
  } catch (error) {
    const classified = error._classified || classifyError(error, provider)
    console.error('[ERROR] AI API error:', classified.code, '-', classified.message)

    if (!res.writableEnded) {
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
  } finally {
    clearTimeout(requestTimeout)
    await releaseSlot?.()
    req.off('aborted', abortClientRequest)
    res.off('close', abortClientRequest)
  }
})

app.get('/api/image', requireUser, imageLimiter, async (req, res) => {
  const prompt = String(req.query.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  if (prompt.length > 2_000) {
    return res.status(413).json({ error: 'prompt is too long', code: 'PROMPT_TOO_LONG' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

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
        signal: controller.signal,
      })

      if (hfRes.ok) {
        const buffer = await hfRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const imageUrl = `data:image/jpeg;base64,${base64}`
        return res.json({ imageUrl, provider: 'huggingface', modelId: model })
      }

      console.warn('[WARN] HF image generation failed:', hfRes.status)
    }
  } catch (error) {
    console.warn('[WARN] HF image generation error:', error.name === 'AbortError' ? 'timed out' : error.message)
  } finally {
    clearTimeout(timeout)
  }

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&nologo=true`
  res.json({ imageUrl, provider: 'pollinations', modelId: 'pollinations/free-image' })
})

app.get('/api/proxy-image', requireUser, proxyLimiter, async (req, res) => {
  const url = String(req.query.url || '').trim()
  if (!url) return res.status(400).json({ error: 'Missing url' })

  const controller = new AbortController()
  const abortStream = () => controller.abort()

  req.on('aborted', abortStream)
  res.on('close', abortStream)

  try {
    const upstream = await fetchAllowedImage(url, { signal: controller.signal })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream responded with ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') || ''
    const mime = contentType.split(';')[0].trim().toLowerCase()
    const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

    if (!allowedImageTypes.has(mime)) {
      return res.status(415).json({ error: 'URL did not return a supported image' })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'public, max-age=86400')

    const contentLength = Number(upstream.headers.get('content-length') || 0)
    if (contentLength > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image is too large' })
    }

    if (!upstream.body) {
      return res.end()
    }

    const reader = upstream.body.getReader()
    let received = 0
    let ended = false

    const pump = () => {
      reader.read().then(({ done, value }) => {
        if (ended) return
        if (done) {
          ended = true
          res.end()
          return
        }

        received += value.byteLength
        if (received > 10 * 1024 * 1024) {
          ended = true
          reader.cancel().catch(() => {})
          res.destroy(new Error('Image is too large'))
          return
        }

        res.write(Buffer.from(value), (err) => {
          if (err) {
            ended = true
            reader.cancel().catch(() => {})
            res.end()
            return
          }
          pump()
        })
      }).catch((error) => {
        if (ended) return
        ended = true
        if (!res.writableEnded) res.end()
        if (error?.name !== 'AbortError') console.warn('[WARN] Image proxy stream failed:', error.message)
      })
    }

    pump()
  } catch (error) {
    if (!res.writableEnded) {
      const status = error.statusCode || (error.name === 'AbortError' ? 499 : 500)
      res.status(status).json({ error: error.message || 'Image proxy failed', code: error.code })
    }
  } finally {
    req.off('aborted', abortStream)
    res.off('close', abortStream)
  }
})

app.get('/api/dashboard', requireUser, modelLimiter, async (req, res) => {
  const userId = req.user.id

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase not configured on backend' })
    }

    const { data: aiModels, error: modelsError } = await supabaseAdmin
      .from('ai_models')
      .select('*')
      .eq('user_id', userId)

    if (modelsError) throw modelsError

    const { data: analytics, error: analyticsError } = await supabaseAdmin
      .from('analytics_data')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (analyticsError) throw analyticsError

    const totalApiRequests = (aiModels || []).reduce((sum, model) => sum + (model.api_requests || 0), 0)
    const totalTokensProcessed = (aiModels || []).reduce((sum, model) => sum + (model.tokens_processed || 0), 0)
    const totalCost = (aiModels || []).reduce((sum, model) => sum + (model.cost || 0), 0)
    const activeModels = (aiModels || []).filter(m => m.status === 'active').length

  // Mask any API keys before sending them to the client — the raw keys
  // should never leave the server. The client gets a masked version for
  // display and must use /api/ai (which looks up the key server-side).
  const maskedModels = (aiModels || []).map(m => ({
    ...m,
    api_key: m.api_key ? maskApiKey(m.api_key) : '',
  }))

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
    aiModels: maskedModels,
    analytics: analytics || [],
  })
  } catch (error) {
    console.error('[ERROR] Dashboard API error:', error.message)
    res.status(500).json({ error: 'Dashboard fetch failed', detail: error.message })
  }
})

// ── Model CRUD endpoints (with encrypted API keys) ──────────
// All routes require a valid Bearer token. The server encrypts api_key
// before storing in Supabase and decrypts when returning for editing.
// The /api/ai endpoint never receives raw keys from the client — it
// looks them up server-side via lookupUserModelKey().

// GET /api/models — list the current user's AI models (keys masked)
app.get('/api/models', requireUser, modelLimiter, async (req, res) => {
  const userId = req.user.id

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured for model management' })

    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    const masked = (data || []).map(m => ({
      ...m,
      api_key: m.api_key ? maskApiKey(m.api_key) : '',
    }))
    res.json({ aiModels: masked })
  } catch (error) {
    console.error('[ERROR] Failed to list models:', error.message)
    res.status(500).json({ error: 'Failed to fetch models' })
  }
})

// GET /api/models/:id — fetch one of the current user's models
app.get('/api/models/:id', requireUser, modelLimiter, async (req, res) => {
  const id = req.params.id
  const userId = req.user.id

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured for model management' })

    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Model not found' })

    const decrypted = { ...data, api_key: decryptApiKey(data.api_key) || '' }
    res.json({ aiModel: decrypted })
  } catch (error) {
    console.error('[ERROR] Failed to fetch model:', error.message)
    res.status(500).json({ error: 'Failed to fetch model' })
  }
})

// POST /api/models — create a model for the current user
app.post('/api/models', requireUser, modelLimiter, async (req, res) => {
  const userId = req.user.id

  if (!req.body.name || !req.body.provider || !req.body.model_id) {
    return res.status(400).json({ error: 'Missing required fields: name, provider, model_id' })
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured for model management' })

    const model = {
      name: String(req.body.name).slice(0, 120),
      provider: String(req.body.provider).slice(0, 80),
      model_id: String(req.body.model_id).slice(0, 200),
      api_key: req.body.api_key ? encryptApiKey(String(req.body.api_key)) : null,
      endpoint: req.body.endpoint ? String(req.body.endpoint).slice(0, 500) : null,
      status: req.body.status === 'inactive' ? 'inactive' : 'active',
      cost: Number(req.body.cost) || 0,
      latency: Number(req.body.latency) || 0,
      api_requests: Number(req.body.api_requests) || 0,
      tokens_processed: Number(req.body.tokens_processed) || 0,
      user_id: userId,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabaseAdmin.from('ai_models').insert([model])
    if (error) throw error

    const saved = { ...model, api_key: model.api_key ? maskApiKey(model.api_key) : '' }
    res.json({ aiModel: saved })
  } catch (error) {
    console.error('[ERROR] Failed to create model:', error.message)
    res.status(500).json({ error: 'Failed to create model' })
  }
})

// PUT /api/models/:id — update one of the current user's models
app.put('/api/models/:id', requireUser, modelLimiter, async (req, res) => {
  const id = req.params.id
  const { api_key, ...updates } = req.body

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured for model management' })

    // Prevent mass-assignment: only known model fields may be updated, and
    // ownership fields can never be changed through the API.
    const patch = {}
    for (const field of ['name', 'provider', 'model_id', 'endpoint', 'status', 'cost', 'latency', 'api_requests', 'tokens_processed']) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) patch[field] = updates[field]
    }

    if (api_key !== undefined && typeof api_key === 'string' && !api_key.includes('••••')) {
      patch.api_key = api_key ? encryptApiKey(api_key) : null
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No updatable fields supplied' })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .update(patch)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Model not found' })

    const saved = { ...data, api_key: data.api_key ? maskApiKey(data.api_key) : '' }
    res.json({ aiModel: saved })
  } catch (error) {
    console.error('[ERROR] Failed to update model:', error.message)
    res.status(500).json({ error: 'Failed to update model' })
  }
})

// DELETE /api/models/:id — delete one of the current user's models
app.delete('/api/models/:id', requireUser, modelLimiter, async (req, res) => {
  const id = req.params.id

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured for model management' })

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('ai_models')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!existing) return res.status(404).json({ error: 'Model not found' })

    const { error } = await supabaseAdmin.from('ai_models').delete().eq('id', id).eq('user_id', req.user.id)
    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('[ERROR] Failed to delete model:', error.message)
    res.status(500).json({ error: 'Failed to delete model' })
  }
})

// ── Knowledge Base endpoints ──────────────────────────────────────────────
// Supports a simple RAG flow: documents are stored per collaboration session,
// and the search endpoint returns the most relevant chunks given a query.
// We use Postgres ILIKE substring matching so it works without an embeddings API
// key — but the structure is designed to be swapped for vector similarity later.

// GET /api/knowledge?sessionId=xxx — list knowledge documents for a session
app.get('/api/knowledge', requireUser, knowledgeLimiter, async (req, res) => {
  const sessionId = req.query.sessionId
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured' })

    if (!(await assertSessionParticipant(sessionId, req.user.id))) {
      return res.status(403).json({ error: 'Not a participant in this session' })
    }

    let documents = []

    const { data, error } = await supabaseAdmin.rpc('list_knowledge_documents', {
      p_session_id: sessionId,
      p_limit: 200,
    })

    if (error) {
      if (error.code !== 'PGRST202' && !/could not find the function/i.test(error.message || '')) {
        throw error
      }

      const { data: fallback, error: fallbackError } = await supabaseAdmin
        .from('knowledge_documents')
        .select('id, session_id, user_id, title, content, created_at, updated_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (fallbackError) throw fallbackError
      documents = (fallback || []).map((doc) => ({ ...doc, content: String(doc.content || '').slice(0, 500) }))
    } else {
      documents = data || []
    }

    res.json({ documents })
  } catch (error) {
    console.error('[ERROR] Failed to list knowledge docs:', error.message)
    res.status(500).json({ error: 'Failed to fetch knowledge documents' })
  }
})

// POST /api/knowledge — create a knowledge document in a session
app.post('/api/knowledge', requireUser, knowledgeLimiter, async (req, res) => {
  const { sessionId, title, content } = req.body

  if (!sessionId || !title || !content) {
    return res.status(400).json({ error: 'Missing required fields: sessionId, title, content' })
  }

  if (String(content).length > 500_000) {
    return res.status(413).json({ error: 'Document is too large', code: 'DOCUMENT_TOO_LARGE' })
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured' })

    if (!(await assertSessionParticipant(sessionId, req.user.id))) {
      return res.status(403).json({ error: 'Not a participant in this session' })
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        session_id: sessionId,
        user_id: req.user.id,
        title: String(title).slice(0, 300),
        content: String(content),
      })
      .select()
      .single()

    if (error) throw error
    res.json({ document: data })
  } catch (error) {
    console.error('[ERROR] Failed to create knowledge doc:', error.message)
    res.status(500).json({ error: 'Failed to create knowledge document' })
  }
})

// POST /api/knowledge/search — RAG: find relevant chunks given a query.
// Uses the Postgres full-text index installed by 06_performance.sql. If the
// migration has not been applied yet (local dev), it falls back to a bounded
// keyword scan so the feature still works.
app.post('/api/knowledge/search', requireUser, knowledgeLimiter, async (req, res) => {
  const { sessionId, query } = req.body
  const topK = Math.min(10, Math.max(1, Number(req.body.topK) || 5))
  const maxChunkLength = Math.min(2_000, Math.max(200, Number(req.body.maxChunkLength) || 1_000))

  if (!sessionId || !query) {
    return res.status(400).json({ error: 'Missing required fields: sessionId, query' })
  }

  if (String(query).length > 2_000) {
    return res.status(413).json({ error: 'query is too long', code: 'QUERY_TOO_LONG' })
  }

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured' })

    if (!(await assertSessionParticipant(sessionId, req.user.id))) {
      return res.status(403).json({ error: 'Not a participant in this session' })
    }

    let results = []

    const { data, error } = await supabaseAdmin.rpc('search_knowledge_documents', {
      p_session_id: sessionId,
      p_query: String(query),
      p_top_k: topK,
    })

    if (error) {
      if (error.code !== 'PGRST202' && !/could not find the function/i.test(error.message || '')) {
        throw error
      }

      // Fallback for an un-migrated database. Bounded so a large session cannot
      // exhaust the instance while scanning.
      const { data: docs, error: listError } = await supabaseAdmin
        .from('knowledge_documents')
        .select('id, title, content')
        .eq('session_id', sessionId)
        .limit(200)

      if (listError) throw listError

      const queryTerms = new Set(String(query).toLowerCase().match(/[a-z0-9]+/g) || [])
      results = (docs || [])
        .map((doc) => {
          const text = (doc.content || '').toLowerCase()
          let score = 0
          const matchedTerms = []

          for (const term of queryTerms) {
            const matches = text.split(term).length - 1
            if (matches > 0) {
              score += matches
              matchedTerms.push(term)
            }
          }

          const titleText = (doc.title || '').toLowerCase()
          for (const term of queryTerms) {
            if (titleText.includes(term)) score += 2
          }

          return { docId: doc.id, title: doc.title, score, matchedTerms, content: doc.content }
        })
        .filter((doc) => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
    } else {
      results = (data || []).map((row) => ({
        docId: row.doc_id,
        title: row.title,
        score: row.relevance,
        matchedTerms: [],
        content: row.content,
      }))
    }

    const chunked = results.map((r) => {
      if (r.content.length <= maxChunkLength) {
        return { docId: r.docId, title: r.title, score: r.score, matchedTerms: r.matchedTerms, chunk: r.content }
      }

      const chunks = []
      const overlap = Math.min(100, Math.floor(maxChunkLength / 4))
      for (let i = 0; i < r.content.length; i += maxChunkLength - overlap) {
        chunks.push({ docId: r.docId, title: r.title, score: r.score, matchedTerms: r.matchedTerms, chunk: r.content.slice(i, i + maxChunkLength) })
      }
      return chunks
    }).flat()

    res.json({ results: chunked })
  } catch (error) {
    console.error('[ERROR] Knowledge search failed:', error.message)
    res.status(500).json({ error: 'Search failed' })
  }
})

// DELETE /api/knowledge/:id — delete one of the current user's documents
app.delete('/api/knowledge/:id', requireUser, knowledgeLimiter, async (req, res) => {
  const id = req.params.id

  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Backend not configured' })

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!existing) return res.status(404).json({ error: 'Document not found or access denied' })

    const { error } = await supabaseAdmin
      .from('knowledge_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    console.error('[ERROR] Failed to delete knowledge doc:', error.message)
    res.status(500).json({ error: 'Failed to delete' })
  }
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ai-proxy] listening on port ${PORT}`)
})

let shuttingDown = false
const shutdown = (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[ai-proxy] ${signal} received, closing server`)

  server.close(() => {
    shutdownRedis().finally(() => process.exit(0))
  })

  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
