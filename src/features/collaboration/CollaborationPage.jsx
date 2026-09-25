import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Send, X, GripVertical, BarChart2, LineChart, PieChart, Table2, Image as ImageIcon, Bot, Users, ChevronDown, Copy, Check, Link, UserPlus, Download, Calendar, Mail, MessageSquare, FileSpreadsheet } from 'lucide-react'
import { useWebSocket } from '../../hooks/useWebSocket'
import {
  BarChart, Bar, LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../../config/supabase'
import supabaseService from '../../services/supabaseService'
import useAuthStore from '../../store/authStore'
import useCollaborationStore from '../../store/collaborationStore'
import useDashboardStore from '../../store/dashboardStore'
import { useNotification } from '../../components/useNotification'
import AIService, { AIError, explainError } from '../../services/aiService'
import { useAIStore } from '../../store/aiStore'

// Built-in free models — kept for image model detection only; model list comes from aiStore
const IMAGE_MODEL_IDS = ['huggingface/free-image']

const PEER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

function generateInviteCode() {
  return 'ZAC-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function extractSessionId(input) {
  const trimmed = (input || '').trim()
  const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuidMatch) return uuidMatch[0]
  return trimmed.toUpperCase()
}

function getPeerColor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length]
}

// ─── Prompt Parser ────────────────────────────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

// ─── AI Integration ────────────────────────────────────────────────────────────
function unpackToolResult(toolResult, modelId) {
  if (!toolResult) return null
  if (toolResult.type === 'widget' && toolResult.schema) return { ...toolResult.schema, model: modelId }
  if (toolResult.type === 'action') return { type: 'text', title: toolResult.message, model: modelId, content: toolResult.message, actionData: toolResult.data }
  return null
}

async function processAIRequest(prompt, modelId, apiKey = null, messages = [], tools = null) {
  try {
    const p = prompt.toLowerCase()
    const isImageModel = modelId.includes('FLUX') || modelId.includes('stable') || modelId.includes('flux') || modelId.includes('pollinations') || modelId.includes('free-image') || modelId.includes('huggingface')
    const isImagePrompt = p.includes('image') || p.includes('picture') || p.includes('photo') || p.includes('draw') || p.includes('illustration') || p.includes('generate an image') || p.includes('create an image')
    const isChartPrompt = p.includes('chart') || p.includes('graph') || p.includes('plot') || p.includes('revenue') || p.includes('trend') || p.includes('breakdown') || p.includes('distribution') || p.includes('table') || p.includes('usage') || p.includes('sales') || p.includes('quarter')
    const isSpreadsheetPrompt = p.includes('spreadsheet') || p.includes('grid') || p.includes('data grid') || p.includes('data table') || p.includes('list of') || p.includes('show data') || p.includes('report')
    const isEmailPrompt = p.includes('email') || p.includes('send') || p.includes('mail')
    const isCalendarPrompt = p.includes('calendar') || p.includes('schedule') || p.includes('meeting') || p.includes('event') || p.includes('remind') || p.includes('appointment')

    if (isImageModel || isImagePrompt) {
      if (isImageModel) {
        const imageUrl = await AIService.generateImage(prompt, modelId)
        if (imageUrl) return { type: 'image', title: prompt.slice(0, 40), model: modelId, imageUrl }
      }
      return { type: 'text', title: 'Image generation not supported', model: modelId, content: `The selected model (${modelId}) does not support image generation.` }
    }

    // Helper: unpack any AI response object into a canvas schema
    const unpack = (result) => {
      if (!result || typeof result !== 'object') return null
      if (result.toolResults?.length > 0) {
        const unpacked = unpackToolResult(result.toolResults[0], modelId)
        if (unpacked) return unpacked
      }
      if (result.type) return { ...result, model: result.model || modelId }
      if (result.schema?.type) return { ...result.schema, model: modelId }
      return null
    }

    // Spreadsheet / email / calendar → always use tool calling
    if ((isSpreadsheetPrompt || isEmailPrompt || isCalendarPrompt) && tools) {
      const result = await AIService.generateResponse(prompt, modelId, 'text', apiKey, messages, tools)
      const unpacked = unpack(result)
      if (unpacked) return unpacked
      const text = typeof result === 'string' ? result : result?.text
      return { type: 'text', title: `AI Response: ${prompt.slice(0, 40)}`, model: modelId, content: text || String(result) }
    }

    // Chart prompts → structured JSON response
    if (isChartPrompt) {
      const structured = await AIService.generateResponse(prompt, modelId, 'structured', apiKey, messages, tools)
      const unpacked = unpack(structured)
      if (unpacked) return unpacked
      if (typeof structured === 'string') return { type: 'text', title: `AI Response: ${prompt.slice(0, 40)}`, model: modelId, content: structured }
    }

    // General text response
    const aiResponse = await AIService.generateResponse(prompt, modelId, 'text', apiKey, messages, tools)
    if (typeof aiResponse === 'string') return { type: 'text', title: `AI Response: ${prompt.slice(0, 40)}`, model: modelId, content: aiResponse }
    const unpacked = unpack(aiResponse)
    if (unpacked) return unpacked
    const text = aiResponse?.text
    return { type: 'text', title: `AI Response: ${prompt.slice(0, 40)}`, model: modelId, content: text || String(aiResponse) }

  } catch (error) {
    console.error('AI processing error:', error)
    const heading = error instanceof AIError
      ? `${error.isCode() ? 'Configuration error' : 'AI provider error'}: ${error.code}`
      : 'Unexpected error'
    const detail = error instanceof AIError ? explainError(error) : error.message
    return {
      type: 'text', title: heading, model: modelId, error: true,
      errorKind: error instanceof AIError ? error.kind : 'code',
      errorCode: error instanceof AIError ? error.code : 'UNKNOWN',
      content: `${detail}\n\nModel: ${modelId}`,
    }
  }
}

// ─── Widget Renderers ─────────────────────────────────────────────────────────
function SpreadsheetWidget({ schema }) {
  const cols = schema.columns || []
  const rows = schema.rows || []
  return (
    <div className="overflow-auto" style={{ maxHeight: 280 }}>
      <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            <th className="w-7 px-1 py-1.5 text-center font-normal border-r border-b" style={{ backgroundColor: 'var(--color-bg-canvas)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border-subtle)' }} />
            {cols.map((col, ci) => (
              <th key={ci} className="px-3 py-1.5 font-semibold text-center border-r border-b whitespace-nowrap" style={{ backgroundColor: 'var(--color-bg-canvas)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-subtle)', minWidth: 90 }}>
                {String.fromCharCode(65 + ci)}
              </th>
            ))}
          </tr>
          <tr>
            <td className="px-1 py-1.5 text-center border-r border-b" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 10 }}>1</td>
            {cols.map((col, ci) => (
              <td key={ci} className="px-3 py-1.5 font-semibold border-r border-b whitespace-nowrap" style={{ backgroundColor: 'var(--color-brand-500)', color: '#fff', borderColor: 'var(--color-border-subtle)' }}>{col}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="px-1 py-1.5 text-center border-r border-b" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 10 }}>{ri + 2}</td>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 border-r border-b whitespace-nowrap" style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border-subtle)', backgroundColor: ri % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-canvas)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CalendarWidget({ schema }) {
  const { summary, start, end, location, description, ics } = schema
  const startDate = start ? new Date(start) : new Date()
  const endDate = end ? new Date(end) : startDate

  const year = startDate.getFullYear()
  const month = startDate.getMonth()
  const eventDay = startDate.getDate()

  const monthName = startDate.toLocaleString('default', { month: 'long' })
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  const downloadIcs = () => {
    if (!ics) return
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${summary || 'event'}.ics`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {/* Month grid */}
      <div>
        <p className="text-xs font-semibold text-center mb-2" style={{ color: 'var(--color-text-secondary)' }}>{monthName} {year}</p>
        <div className="grid grid-cols-7 gap-px text-center">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-xs font-medium py-0.5" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
          ))}
          {cells.map((day, i) => (
            <div key={i} className={`text-xs py-1 rounded-md font-medium ${
              day === eventDay
                ? 'text-white'
                : 'text-[var(--color-text-secondary)]'
            }`}
            style={day === eventDay ? { backgroundColor: 'var(--color-brand-500)' } : {}}>
              {day || ''}
            </div>
          ))}
        </div>
      </div>
      {/* Event details */}
      <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: 'var(--color-bg-canvas)', border: '1px solid var(--color-border-subtle)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{summary}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {startDate.toLocaleDateString(undefined, { dateStyle: 'medium' })} · {fmt(start)} – {fmt(end)}
        </p>
        {location && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>📍 {location}</p>}
        {description && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>}
      </div>
      {ics && (
        <button onClick={downloadIcs} className="w-full py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--color-brand-500)' }}>
          Download .ics
        </button>
      )}
    </div>
  )
}

function WidgetChart({ schema }) {
  if (schema.type === 'bar') return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={schema.data.map(d => ({ name: d.label, v: d.value }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip />
        <Bar dataKey="v" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  if (schema.type === 'line') return (
    <ResponsiveContainer width="100%" height={160}>
      <ReLineChart data={schema.data.map(d => ({ name: d.label, v: d.value }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip />
        <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
      </ReLineChart>
    </ResponsiveContainer>
  )

  if (schema.type === 'pie') return (
    <ResponsiveContainer width="100%" height={160}>
      <RePieChart>
        <Pie data={schema.data.map(d => ({ name: d.label, value: d.value }))} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name }) => name} labelLine={false} fontSize={11}>
          {schema.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </RePieChart>
    </ResponsiveContainer>
  )

  if (schema.type === 'table') return (
    <div className="divide-y divide-slate-100">
      {schema.data.map((row, i) => (
        <div key={i} className="flex justify-between py-2 text-sm">
          <span className="text-slate-600">{row.label}</span>
          <span className="font-medium text-slate-800">{row.value}</span>
        </div>
      ))}
    </div>
  )

  if (schema.type === 'spreadsheet') return <SpreadsheetWidget schema={schema} />
  if (schema.type === 'calendar') return <CalendarWidget schema={schema} />

  if (schema.type === 'email') return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-brand-500)' }} />
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>To</p>
          <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{schema.to}</p>
          {schema.subject && <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Subject: {schema.subject}</p>}
          {schema.sent === false && <p className="text-xs mt-1 text-amber-500">⚠️ Not sent — SMTP not configured</p>}
          {schema.sent === true && <p className="text-xs mt-1 text-emerald-500">✓ Sent</p>}
        </div>
      </div>
    </div>
  )

  if (schema.type === 'image') return (
    <div>
      <img src={schema.imageUrl} alt={schema.title} className="w-full h-auto rounded-lg border" style={{ borderColor: 'var(--color-border-subtle)' }} />
    </div>
  )

  return null
}

const TYPE_ICON = {
  bar: BarChart2, line: LineChart, pie: PieChart, table: Table2,
  image: ImageIcon, spreadsheet: FileSpreadsheet,
  calendar: Calendar, email: Mail,
}

const WIDGET_WIDTH = {
  spreadsheet: 'min-w-[380px] max-w-[560px]',
  calendar: 'min-w-[260px] max-w-[300px]',
  email: 'min-w-[240px] max-w-[320px]',
  image: 'min-w-[200px] max-w-[320px]',
  default: 'min-w-[200px] max-w-[300px]',
}

// ─── Draggable Widget ─────────────────────────────────────────────────────────
function Widget({ widget, onMove, onRemove }) {
  const dragOffset = useRef(null)
  const isDragging = useRef(false)

  const getClientCoords = (e) => {
    if (e.touches && e.touches[0]) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
    }
    return { clientX: e.clientX, clientY: e.clientY }
  }

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    isDragging.current = false
    const { clientX, clientY } = getClientCoords(e)
    dragOffset.current = { x: clientX - widget.x, y: clientY - widget.y }

    const onPointerMove = (ev) => {
      isDragging.current = true
      const { clientX: cx, clientY: cy } = getClientCoords(ev)
      onMove(widget.id, {
        x: Math.max(0, cx - dragOffset.current.x),
        y: Math.max(0, cy - dragOffset.current.y),
      })
    }
    const onPointerUp = () => {
      document.removeEventListener('mousemove', onPointerMove)
      document.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('touchmove', onPointerMove)
      document.removeEventListener('touchend', onPointerUp)
    }
    document.addEventListener('mousemove', onPointerMove)
    document.addEventListener('mouseup', onPointerUp)
    document.addEventListener('touchmove', onPointerMove, { passive: false })
    document.addEventListener('touchend', onPointerUp)
  }

  const handleDownload = async () => {
    if (widget.schema.type !== 'image' || !widget.schema.imageUrl) return
    try {
      const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
      const proxyUrl = backendUrl ? `${backendUrl}/proxy-image?url=${encodeURIComponent(widget.schema.imageUrl)}` : widget.schema.imageUrl
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
      const ext = mimeToExt[blob.type] || 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${widget.schema.title || 'image'}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.warn('Download failed:', err)
    }
  }

  const Icon = TYPE_ICON[widget.schema.type] || BarChart2

  return (
    <div
      onMouseDown={onPointerDown}
      onTouchStart={onPointerDown}
      className={`absolute border rounded-xl shadow-sm select-none touch-none w-[85vw] overflow-hidden ${WIDGET_WIDTH[widget.schema.type] || WIDGET_WIDTH.default}`}
      style={{ left: widget.x, top: widget.y, backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: 'var(--color-brand-500)' }} />
          <span className="text-sm font-semibold truncate max-w-[220px]" style={{ color: 'var(--color-text-primary)' }}>{widget.schema.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {widget.schema.type === 'image' && (
            <button onClick={(e) => { e.stopPropagation(); handleDownload() }} className="p-1 rounded cursor-pointer transition-colors hover:opacity-70" style={{ color: 'var(--color-text-muted)' }} title="Download image">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <GripVertical className="w-4 h-4" style={{ color: 'var(--color-border-subtle)' }} />
          <button onClick={() => onRemove(widget.id)} className="p-1 rounded cursor-pointer transition-colors hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 min-w-0" style={{ width: '100%' }}>
        <WidgetChart schema={widget.schema} />
      </div>
    </div>
  )
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function ChatPanel({ onAddWidget, mobileOpen, onMobileClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Describe a chart or data view and I\'ll add it to the canvas. Try: "Show Q3 revenue" or "Usage breakdown". Note: Responses may be simulated if API keys are not configured.' }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState('openrouter/google/gemma-4-26b-a4b-it:free')
  const bottomRef = useRef(null)
  const { addNotification } = useNotification()

  // All models come from aiStore (built-in free + user-registered)
  const { aiModels: allModels } = useAIStore()

  // Check backend status on mount
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || ''
        const response = await fetch(`${backendUrl}/health`);
        const data = await response.json();
        if (!response.ok) {
          setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Backend server is running but may not have API keys configured. Responses will be simulated.' }]);
        } else if (data.providers && (!data.providers.google || !data.providers.openrouter)) {
          setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Some API keys are not configured. Using simulated responses as fallback.' }]);
        }
      } catch (error) {
        console.warn('Backend status check failed:', error.message);
        setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Backend server not reachable. Using simulated responses.' }]);
      }
    };
    checkBackendStatus();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setMessages(m => [...m, { role: 'user', text }])
    setInput('')
    setThinking(true)

    try {
      const selectedModel = allModels.find(m => m.id === selectedModelId)
      // Build conversation history from previous messages (exclude the just-added user message)
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.text }))
      // Tools available for this request
      const toolNames = ['create_spreadsheet', 'create_chart', 'send_email', 'create_calendar_event']
      const schema = await processAIRequest(text, selectedModelId, selectedModel?.api_key || null, history, toolNames)

      if (schema?.error) {
        const isCode = schema.errorKind === 'code'
        const notificationType = isCode ? 'error' : 'warning'
        const title = isCode ? 'AI is misconfigured' : 'AI provider error'
        addNotification(explainError({ code: schema.errorCode, provider: null, message: schema.content, kind: schema.errorKind }), notificationType, title)
        setMessages(m => [...m, { role: 'assistant', text: `⚠️ ${schema.title}\n\n${schema.content}` }])
        return
      }

      // Action results (email, calendar) → also add as a canvas widget
      if (schema.actionData) {
        setMessages(m => [...m, { role: 'assistant', text: schema.content, actionData: schema.actionData }])
        // Build a canvas widget from the action data
        const actionSchema = schema.actionData.ics
          ? { type: 'calendar', title: schema.actionData.summary || 'Calendar Event', ...schema.actionData }
          : schema.actionData.to
            ? { type: 'email', title: `Email: ${schema.actionData.subject || schema.actionData.to}`, ...schema.actionData }
            : null
        if (actionSchema) onAddWidget(actionSchema)
        const { recordRequest, recordConversation } = useAIStore.getState()
        recordRequest(selectedModelId, schema.content)
        recordConversation(selectedModelId, text, schema.content)
        useDashboardStore.getState().computeMetrics()
        return
      }

      onAddWidget(schema)
      const modelName = selectedModel?.name || selectedModelId

      let aiResponseText = `Added "${schema.title}" to the canvas`
      if (schema.type === 'text') aiResponseText = schema.content
      else if (schema.type === 'image') aiResponseText = `Generated image: "${schema.title}" using ${modelName}.`
      else if (schema.type === 'spreadsheet') aiResponseText = `Created spreadsheet "${schema.title}" using ${modelName}.`
      else if (schema.type === 'calendar') aiResponseText = `Calendar event "${schema.title}" added to canvas.`
      else if (schema.type === 'email') aiResponseText = `Email widget "${schema.title}" added to canvas.`
      else aiResponseText += ` as a ${schema.type} chart using ${modelName}.`

      setMessages(m => [...m, { role: 'assistant', text: aiResponseText, schema }])

      // Record into aiStore for metrics + Recent Activity
      const { recordRequest, recordConversation } = useAIStore.getState()
      recordRequest(selectedModelId, aiResponseText)
      recordConversation(selectedModelId, text, aiResponseText)
      useDashboardStore.getState().computeMetrics()
    } catch (error) {
      console.error('Error processing AI request:', error)
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, I encountered an unexpected error. Try changing the model or simplifying your request.' }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-7 h-7 rounded-lg object-cover" />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Prompt</span>
        <div className="ml-auto relative">
          <select
            value={selectedModelId}
            onChange={e => setSelectedModelId(e.target.value)}
            className="appearance-none pl-2 pr-7 py-1 rounded-md border text-xs font-medium outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] cursor-pointer"
            style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
          >
            {allModels.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        {mobileOpen && (
          <button onClick={onMobileClose} className="min-1440:hidden p-1 -mr-2 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-sm'
                  : 'rounded-bl-sm'
              }`}
              style={msg.role === 'user'
                ? { backgroundColor: 'var(--color-brand-500)', color: '#fff' }
                : { backgroundColor: 'var(--color-bg-canvas)', color: 'var(--color-text-secondary)' }
              }
            >
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl rounded-bl-sm text-sm" style={{ backgroundColor: 'var(--color-bg-canvas)', color: 'var(--color-text-muted)' }}>
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type here"
            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] transition-all"
            style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="p-2 rounded-lg text-white transition-opacity disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────
function InviteDialog({ inviteCode, onClose, onJoin }) {
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  const inviteUrl = inviteCode ? `zac://collab/join/${inviteCode}` : ''

  const copyToClipboard = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleJoin = () => {
    const code = joinCode.trim()
    if (!code) return
    setJoining(true)
    setTimeout(() => {
      onJoin(code)
      setJoinCode('')
      setJoining(false)
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 min-750:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md rounded-xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-7 h-7 rounded-lg object-cover" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Invite Collaborators</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {inviteCode && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Share this invite code</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-lg border font-mono text-sm tracking-wider"
                  style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}>
                  {inviteCode}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="p-2.5 rounded-lg border transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}
                  title="Copy invite code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
                </button>
              </div>
            </div>
          )}

          <div className="border-t pt-5" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Join a session</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="flex-1 px-3 py-2.5 rounded-lg border text-sm font-mono tracking-wider outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] transition-all uppercase"
                style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
              />
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim() || joining}
                className="px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-40 cursor-pointer flex items-center gap-2"
                style={{ backgroundColor: 'var(--color-brand-500)' }}
              >
                {joining ? (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                  </span>
                ) : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ModelExplainerModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-7 h-7 rounded-lg object-cover" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Models Overview</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Choose the right model for your task. Each model has different strengths:
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Gemma 4 26B A4B (Free)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>General purpose open-source model. Good for everyday chat and simple text tasks.</p>
            </div>

            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>GPT-OSS 20B (Free)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Open-source GPT alternative. Reliable for general conversation and reasoning tasks.</p>
            </div>

            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>North Mini Code (Free)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Optimized for code generation and technical questions.</p>
            </div>

            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Laguna S 2.1 (Free)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Balanced model for general chat and light reasoning.</p>
            </div>

            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-canvas)', borderColor: 'var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Free Image Gen (HF)</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>Generates images from text prompts. Use for visual content creation.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function uniqueWidgets(list) {
  const seen = new Set()
  return list.filter(w => {
    if (seen.has(w.id)) return false
    seen.add(w.id)
    return true
  })
}

export default function CollaborationPage() {
  const [widgets, setWidgets] = useState([])
  const [peers, setPeers] = useState({})
  const [chatOpen, setChatOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [showExplainer, setShowExplainer] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const { user } = useAuthStore();
  const { addNotification } = useNotification();
  const { setSession, setDisconnectUser, clearSession } = useCollaborationStore();
  const currentUser = {
    id: user?.id || 'anonymous',
    name: user?.name || user?.email?.split('@')[0] || 'Anonymous',
    color: getPeerColor(user?.id || 'anonymous'),
  }
  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser
  const cursorsRef = useRef({})
  const canvasRef = useRef(null)

  // Load widgets from localStorage as fallback
  const loadLocalWidgets = useCallback(() => {
    try {
      const stored = localStorage.getItem('zac-collab-widgets');
      if (stored) {
        const parsed = JSON.parse(stored);
        setWidgets(parsed);
      }
    } catch (e) {
      console.warn('Could not load local widgets:', e);
    }
  }, []);

  const saveLocalWidgets = useCallback((widgets) => {
    try {
      localStorage.setItem('zac-collab-widgets', JSON.stringify(widgets));
    } catch (e) {
      console.warn('Could not save local widgets:', e);
    }
  }, []);

  // Ensure a collaboration session exists for the current user
  useEffect(() => {
    if (!user?.id || sessionId) return;

    let active = true;
    (async () => {
      try {
        if (!supabase) return;
        const sid = await supabaseService.ensureUserSession(user.id);
        if (!active) return;
        setSessionId(sid);
        setSession(sid);
      } catch (error) {
        console.warn('Could not ensure collaboration session:', error.message);
      }
    })();

    return () => { active = false; };
  }, [user?.id, sessionId, setSession]);

  // Show explainer modal for first-time users
  useEffect(() => {
    const seen = localStorage.getItem('zac-collab-explainer-seen')
    if (!seen) {
      setShowExplainer(true)
    }
  }, []);

  // Load widgets from Supabase whenever the session changes
  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      try {
        if (!supabase) {
          loadLocalWidgets();
          return;
        }

        const { data, error } = await supabase
          .from('dashboard_widgets')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const loadedWidgets = (data || []).map(widget => ({
          id: widget.id,
          schema: widget.schema,
          x: widget.position_x || 40,
          y: widget.position_y || 40,
        }));

        if (loadedWidgets.length > 0) {
          setWidgets(loadedWidgets);
        } else {
          loadLocalWidgets();
        }
      } catch (error) {
        console.warn('Could not load widgets from Supabase, using local storage:', error.message);
        loadLocalWidgets();
      }
    })();
  }, [sessionId, loadLocalWidgets]);

  // Check if current user is the host of the session
  useEffect(() => {
    if (!sessionId || !user?.id || !supabase) return;

    let active = true;
    (async () => {
      try {
        const session = await supabaseService.getSession(sessionId);
        if (!active) return;
        const host = session?.created_by === user.id;
        setIsHost(host);
        setSession(sessionId, host);
      } catch (error) {
        console.warn('Could not check session host:', error.message);
      }
    })();

    return () => { active = false; };
  }, [sessionId, user?.id, setSession]);

  const disconnectUser = useCallback(async (targetUserId) => {
    if (!sessionId || !supabase) return;
    try {
      await supabaseService.removeParticipant(sessionId, targetUserId);
      addNotification('User disconnected from session', 'success');
    } catch (error) {
      console.warn('Could not disconnect user:', error.message);
      addNotification('Could not disconnect user', 'error');
    }
  }, [sessionId, addNotification]);

  // Update collaboration store when disconnect handler changes
  useEffect(() => {
    setDisconnectUser(disconnectUser);
  }, [disconnectUser, setDisconnectUser]);

  // Subscribe to real-time widget changes from Supabase
  useEffect(() => {
    if (!supabase || !sessionId) return;

    const channel = supabase
      .channel('widgets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_widgets',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const widget = payload.new || payload.old;
          if (!widget) return;

          switch (payload.eventType) {
            case 'INSERT':
              setWidgets(prev => uniqueWidgets([...prev, {
                id: widget.id,
                schema: widget.schema,
                x: widget.position_x || 40,
                y: widget.position_y || 40,
              }]));
              break;
            case 'UPDATE':
              setWidgets(prev =>
                prev.map(w => 
                  w.id === widget.id 
                    ? { ...w, x: widget.position_x, y: widget.position_y } 
                    : w
                )
              );
              break;
            case 'DELETE':
              setWidgets(prev => prev.filter(w => w.id !== widget.id));
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const updateCursorDOM = useCallback(({ peerId, name, color, x, y }) => {
    // Get the canvas container bounds for relative positioning
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    
    const canvasRect = canvasElement.getBoundingClientRect();
    
    // Convert page coordinates to canvas-relative coordinates
    const canvasRelativeX = x - canvasRect.left;
    const canvasRelativeY = y - canvasRect.top;
    
    // Ensure the cursor element exists in the DOM
    if (!cursorsRef.current[peerId]) {
      const el = document.createElement('div')
      el.id = `cursor-${peerId}`
      el.style.cssText = `position:absolute;pointer-events:none;z-index:9999;transition:left 0.3s ease,top 0.3s ease;`
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M0 0L0 12L3.5 8.5L6 14L8 13L5.5 7.5L10 7.5L0 0Z" fill="${color}" stroke="white" stroke-width="1"/>
        </svg>
        <span style="margin-left:6px;font-size:11px;font-weight:600;color:#fff;background:${color};padding:1px 6px;border-radius:4px;">${name}</span>
      `
      canvasElement.appendChild(el)
      cursorsRef.current[peerId] = el
    }
    const el = cursorsRef.current[peerId]
    el.style.left = `${canvasRelativeX}px`
    el.style.top = `${canvasRelativeY}px`
  }, [])

  const removeCursorDOM = useCallback((peerId) => {
    // Remove cursor element from DOM and from reference
    if (cursorsRef.current[peerId]) {
      cursorsRef.current[peerId].remove()
      delete cursorsRef.current[peerId]
    }
  }, [])

  const addPeer = useCallback((peer) => {
    setPeers(p => ({ ...p, [peer.id]: peer }))
  }, [])

  const removePeer = useCallback((peerId) => {
    setPeers(p => { 
      const n = { ...p }; 
      delete n[peerId]; 
      return n 
    })
    // Add a small delay before removing cursor to ensure proper cleanup
    setTimeout(() => removeCursorDOM(peerId), 100)
  }, [removeCursorDOM])

  const { send } = useWebSocket({
    room: sessionId,
    user: currentUser,
    onCursorMove: updateCursorDOM,
    onWidgetSync: (widget) => setWidgets(prev => uniqueWidgets(
      prev.find(w => w.id === widget.id)
        ? prev.map(w => w.id === widget.id ? { ...w, ...widget } : w)
        : [...prev, widget]
    )),
    onPeerJoin: (peer) => addPeer(peer),
    onPeerLeave: (peerId) => removePeer(peerId),
  })

  useEffect(() => {
    const handler = (e) => {
      if (sessionId) {
        send('cursor:move', {
          peerId: currentUserRef.current.id,
          name: currentUserRef.current.name,
          color: currentUserRef.current.color,
          x: e.clientX,
          y: e.clientY,
        })
      }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [send, sessionId])

  useEffect(() => {
    const cursors = cursorsRef.current
    return () => {
      // Clean up all cursor elements when component unmounts
      Object.keys(cursors).forEach(key => {
        if (cursors[key]) {
          cursors[key].remove()
        }
      })
    }
  }, [])

  const addWidget = useCallback(async (schema) => {
    const id = crypto.randomUUID()
    const widget = {
      id,
      schema,
      x: 40 + (Math.random() * 260),
      y: 40 + (Math.random() * 160),
    }
    
    setWidgets(prev => {
      const next = uniqueWidgets([...prev, widget])
      saveLocalWidgets(next)
      return next
    })
    
    // Try to save to Supabase, fallback to local storage
    if (supabase && sessionId) {
      try {
        await supabase
          .from('dashboard_widgets')
          .insert([{
            id: widget.id,
            schema: widget.schema,
            position_x: Math.round(widget.x),
            position_y: Math.round(widget.y),
            session_id: sessionId,
          }]);
      } catch (error) {
        console.warn('Could not save widget to Supabase, using local storage:', error.message);
      }
    }
    
    send('widget:add', widget)
  }, [send, sessionId, saveLocalWidgets])

  const moveWidget = useCallback(async (id, pos) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, ...pos } : w)
      saveLocalWidgets(next)
      return next
    })
    
    // Update in Supabase if available
    if (supabase) {
      try {
        await supabase
          .from('dashboard_widgets')
          .update({ position_x: Math.round(pos.x), position_y: Math.round(pos.y) })
          .eq('id', id);
      } catch (error) {
        console.warn('Could not update widget position in Supabase:', error.message);
      }
    }
    
    send('widget:move', { id, ...pos })
  }, [send, saveLocalWidgets])

  const removeWidget = useCallback(async (id) => {
    setWidgets(prev => {
      const next = prev.filter(w => w.id !== id)
      saveLocalWidgets(next)
      return next
    })
    
    // Remove from Supabase if available
    if (supabase) {
      try {
        await supabase
          .from('dashboard_widgets')
          .delete()
          .eq('id', id);
      } catch (error) {
        console.warn('Could not remove widget from Supabase:', error.message);
      }
    }
  }, [saveLocalWidgets])

  const handleCreateInvite = () => {
    // The session id is the real room key — sharing it lets another user join
    // the same Supabase Realtime channel and see each other's cursors/widgets.
    setInviteCode(sessionId || generateInviteCode())
    setInviteDialogOpen(true)
  }

  const dismissExplainer = () => {
    try {
      localStorage.setItem('zac-collab-explainer-seen', 'true')
    } catch { /* ignore storage errors */ }
    setShowExplainer(false)
  }

  const handleJoinSession = (code) => {
    const session = extractSessionId(code)
    if (!session) {
      setInviteDialogOpen(false)
      return
    }
    
    if (!supabase || !isUUID(session)) {
      setSessionId(session)
      setSession(session)
      setInviteDialogOpen(false)
      return
    }
    
    supabase
      .from('collaboration_sessions')
      .select('id')
      .eq('id', session)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          return supabase
            .from('session_participants')
            .upsert({ session_id: data.id, user_id: user?.id || currentUser.id }, { onConflict: ['session_id', 'user_id'] })
            .then(() => data.id)
        }
        return session
      })
      .then((resolvedId) => {
        setSessionId(resolvedId)
        setSession(resolvedId)
        setInviteDialogOpen(false)
      })
      .catch((error) => {
        console.warn('Could not join session via Supabase, using local mode:', error.message)
        setSessionId(session)
        setSession(session)
        setInviteDialogOpen(false)
      })
  }

  // Calculate peer list from the local state (peers)
  const peerList = Object.values(peers).filter(peer => peer.id !== currentUser.id);

  return (
    <div className="flex h-full -m-4 min-750:-m-6 min-1440:-m-8 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* Canvas */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-canvas)' }}>
        {/* Grid dots background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--color-border-subtle)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Peer presence bar - using local peer state */}
        {peerList.length > 0 && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
            <Users className="w-3.5 h-3.5" />
            {peerList.map(p => (
              <span key={p.id} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            ))}
            <span style={{ color: 'var(--color-text-muted)' }}>online</span>
          </div>
        )}

        {/* Invite button - appears in peer bar area on desktop, floating on mobile */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={handleCreateInvite}
            className="hidden min-750:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors cursor-pointer hover:opacity-80"
            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        </div>

        {/* Mobile chat toggle */}
        <button
          onClick={() => setChatOpen(v => !v)}
          className="min-1440:hidden absolute bottom-4 right-4 z-20 p-3 rounded-full shadow-lg text-white cursor-pointer"
          style={{ backgroundColor: 'var(--color-brand-500)' }}
        >
          {chatOpen ? <X className="w-5 h-5" /> : <Send className="w-5 h-5" />}
        </button>

        {/* Mobile invite button */}
        <button
          onClick={handleCreateInvite}
          className="min-1440:hidden absolute top-4 right-4 z-20 p-3 rounded-full shadow-lg text-white cursor-pointer"
          style={{ backgroundColor: 'var(--color-brand-500)' }}
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* Empty state */}
        {widgets.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 opacity-20" style={{ backgroundColor: 'var(--color-brand-500)' }}>
              <BarChart2 className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-medium opacity-30" style={{ color: 'var(--color-text-primary)' }}>Canvas is empty</p>
            <p className="text-xs mt-1 opacity-20" style={{ color: 'var(--color-text-muted)' }}>Use the AI prompt to add widgets</p>
          </div>
        )}

        {uniqueWidgets(widgets).filter(w => w.schema.type !== 'text').map(w => (
          <Widget key={w.id} widget={w} onMove={moveWidget} onRemove={removeWidget} />
        ))}
      </div>

      {/* Chat Panel - Desktop: side-by-side, Mobile: overlay */}
      <div className={`
        min-1440:relative min-1440:translate-x-0 min-1440:z-auto
        fixed inset-y-0 right-0 z-50 w-72 border-l flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${chatOpen ? 'translate-x-0' : 'translate-x-full'}
      `} style={{ borderColor: 'var(--color-border-subtle)' }}>
        <ChatPanel onAddWidget={addWidget} mobileOpen={chatOpen} onMobileClose={() => setChatOpen(false)} />
      </div>

      {/* Backdrop for mobile chat */}
      {chatOpen && (
        <div
          className="min-1440:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setChatOpen(false)}
        />
      )}

      {/* Invite Dialog */}
      {inviteDialogOpen && (
        <InviteDialog
          inviteCode={inviteCode}
          onClose={() => { setInviteDialogOpen(false); setInviteCode('') }}
          onJoin={handleJoinSession}
        />
      )}

      {/* Model Explainer Modal - first time only */}
      {showExplainer && (
        <ModelExplainerModal onClose={dismissExplainer} />
      )}
    </div>
  )
}
