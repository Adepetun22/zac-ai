import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, X, GripVertical, BarChart2, LineChart, PieChart, Table2, Bot, Users } from 'lucide-react'
import { useWebSocket } from '../../hooks/useWebSocket'
import {
  BarChart, Bar, LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ─── Prompt Parser ────────────────────────────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

function parsePrompt(prompt) {
  const p = prompt.toLowerCase()

  if (p.includes('q3') || p.includes('quarter') || p.includes('revenue') || p.includes('sales')) {
    return {
      type: 'bar', title: 'Q3 Revenue Summary',
      data: [
        { label: 'Jul', value: 42000 }, { label: 'Aug', value: 58000 },
        { label: 'Sep', value: 51000 },
      ],
    }
  }
  if (p.includes('trend') || p.includes('growth') || p.includes('over time') || p.includes('weekly')) {
    return {
      type: 'line', title: 'Growth Trend',
      data: [
        { label: 'W1', value: 120 }, { label: 'W2', value: 145 },
        { label: 'W3', value: 132 }, { label: 'W4', value: 178 },
      ],
    }
  }
  if (p.includes('breakdown') || p.includes('distribution') || p.includes('share') || p.includes('usage')) {
    return {
      type: 'pie', title: 'Usage Distribution',
      data: [
        { label: 'GPT-4o', value: 45 }, { label: 'Claude', value: 30 },
        { label: 'Gemini', value: 15 }, { label: 'Other', value: 10 },
      ],
    }
  }
  if (p.includes('table') || p.includes('list') || p.includes('log') || p.includes('summar')) {
    return {
      type: 'table', title: 'Activity Summary',
      data: [
        { label: 'GPT-4o', value: '45.2K requests' },
        { label: 'Claude 3.5', value: '32.1K requests' },
        { label: 'Gemini Pro', value: '28.4K requests' },
      ],
    }
  }

  return {
    type: 'bar', title: prompt.slice(0, 40),
    data: [
      { label: 'A', value: Math.floor(Math.random() * 80 + 20) },
      { label: 'B', value: Math.floor(Math.random() * 80 + 20) },
      { label: 'C', value: Math.floor(Math.random() * 80 + 20) },
    ],
  }
}

// ─── Widget Renderers ─────────────────────────────────────────────────────────
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

  return null
}

const TYPE_ICON = { bar: BarChart2, line: LineChart, pie: PieChart, table: Table2 }

// ─── Draggable Widget ─────────────────────────────────────────────────────────
function Widget({ widget, onMove, onRemove }) {
  const dragOffset = useRef(null)

  const onMouseDown = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    dragOffset.current = { x: e.clientX - widget.x, y: e.clientY - widget.y }

    const onMouseMove = (ev) => {
      onMove(widget.id, {
        x: Math.max(0, ev.clientX - dragOffset.current.x),
        y: Math.max(0, ev.clientY - dragOffset.current.y),
      })
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const Icon = TYPE_ICON[widget.schema.type] || BarChart2

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute bg-white border border-slate-200 rounded-xl shadow-sm select-none"
      style={{ left: widget.x, top: widget.y, width: 300 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">{widget.schema.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <GripVertical className="w-4 h-4 text-slate-300" />
          <button onClick={() => onRemove(widget.id)} className="p-1 hover:bg-slate-100 rounded cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <WidgetChart schema={widget.schema} />
      </div>
    </div>
  )
}

// ─── Live Cursor ──────────────────────────────────────────────────────────────
function LiveCursor({ name, color, x, y }) {
  return (
    <div className="pointer-events-none fixed z-40 transition-all duration-300 ease-out" style={{ left: x, top: y }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M0 0L0 12L3.5 8.5L6 14L8 13L5.5 7.5L10 7.5L0 0Z" fill={color} stroke="white" strokeWidth="1" />
      </svg>
      <span className="ml-3 -mt-1 block text-[11px] font-semibold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: color }}>
        {name}
      </span>
    </div>
  )
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function ChatPanel({ onAddWidget }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Describe a chart or data view and I\'ll add it to the canvas. Try: "Show Q3 revenue" or "Usage breakdown".' }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || thinking) return
    setMessages(m => [...m, { role: 'user', text }])
    setInput('')
    setThinking(true)

    setTimeout(() => {
      const schema = parsePrompt(text)
      onAddWidget(schema)
      setMessages(m => [...m, {
        role: 'assistant',
        text: `Added "${schema.title}" to the canvas as a ${schema.type} chart.`,
        schema,
      }])
      setThinking(false)
    }, 900)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-500)' }}>
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Prompt</span>
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
            placeholder="e.g. Show Q3 revenue..."
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

// ─── Main Page ────────────────────────────────────────────────────────────────
let widgetIdCounter = 1

export default function CollaborationPage() {
  const [widgets, setWidgets] = useState([])
  const [peers, setPeers] = useState({})
  const cursorsRef = useRef({})
  const canvasRef = useRef(null)

  // Use raw DOM for cursor elements — isolated from React render cycle
  const updateCursorDOM = useCallback(({ peerId, name, color, x, y }) => {
    if (!cursorsRef.current[peerId]) {
      const el = document.createElement('div')
      el.id = `cursor-${peerId}`
      el.style.cssText = `position:fixed;pointer-events:none;z-index:9999;transition:left 0.3s ease,top 0.3s ease;`
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M0 0L0 12L3.5 8.5L6 14L8 13L5.5 7.5L10 7.5L0 0Z" fill="${color}" stroke="white" stroke-width="1"/>
        </svg>
        <span style="margin-left:6px;font-size:11px;font-weight:600;color:#fff;background:${color};padding:1px 6px;border-radius:4px;">${name}</span>
      `
      document.body.appendChild(el)
      cursorsRef.current[peerId] = el
    }
    const el = cursorsRef.current[peerId]
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [])

  const removeCursorDOM = useCallback((peerId) => {
    cursorsRef.current[peerId]?.remove()
    delete cursorsRef.current[peerId]
  }, [])

  const { send } = useWebSocket({
    onCursorMove: updateCursorDOM,
    onWidgetSync: (widget) => setWidgets(prev =>
      prev.find(w => w.id === widget.id)
        ? prev.map(w => w.id === widget.id ? { ...w, ...widget } : w)
        : [...prev, widget]
    ),
    onPeerJoin: (peer) => setPeers(p => ({ ...p, [peer.id]: peer })),
    onPeerLeave: (peerId) => {
      setPeers(p => { const n = { ...p }; delete n[peerId]; return n })
      removeCursorDOM(peerId)
    },
  })

  // Broadcast own cursor
  useEffect(() => {
    const handler = (e) => send('cursor:move', { x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [send])

  // Cleanup cursor DOM on unmount
  useEffect(() => {
    return () => Object.keys(cursorsRef.current).forEach(removeCursorDOM)
  }, [])

  const addWidget = useCallback((schema) => {
    const id = `widget-${widgetIdCounter++}`
    const widget = {
      id,
      schema,
      x: 40 + ((widgetIdCounter * 60) % 300),
      y: 40 + ((widgetIdCounter * 40) % 200),
    }
    setWidgets(prev => [...prev, widget])
    send('widget:add', widget)
  }, [send])

  const moveWidget = useCallback((id, pos) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...pos } : w))
    send('widget:move', { id, ...pos })
  }, [send])

  const removeWidget = useCallback((id) => {
    setWidgets(prev => prev.filter(w => w.id !== id))
  }, [])

  const peerList = Object.values(peers)

  return (
    <div className="flex h-full gap-0 -m-4 min-750:-m-6 min-1440:-m-8 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

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

        {/* Peer presence bar */}
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

        {/* Widgets */}
        {widgets.map(w => (
          <Widget key={w.id} widget={w} onMove={moveWidget} onRemove={removeWidget} />
        ))}
      </div>

      {/* Chat Panel */}
      <div className="w-72 border-l flex-shrink-0" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <ChatPanel onAddWidget={addWidget} />
      </div>
    </div>
  )
}
