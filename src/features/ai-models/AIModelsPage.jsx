import { useState } from 'react'
import { Search, Plus, Edit, Trash2, Play, X, Check } from 'lucide-react'

const models = [
  { id: 1, name: 'GPT-4o', provider: 'OpenAI', status: 'active', requests: '45.2K', latency: '245ms', cost: '$0.12/1K' },
  { id: 2, name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'active', requests: '32.1K', latency: '312ms', cost: '$0.15/1K' },
  { id: 3, name: 'Gemini Pro', provider: 'Google', status: 'active', requests: '28.4K', latency: '198ms', cost: '$0.10/1K' },
  { id: 4, name: 'Llama 3 70B', provider: 'Meta', status: 'inactive', requests: '12.8K', latency: '456ms', cost: '$0.05/1K' },
  { id: 5, name: 'Mistral Large', provider: 'Mistral AI', status: 'active', requests: '8.9K', latency: '267ms', cost: '$0.11/1K' },
]

function ModelRowActions({ model, onRun, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (confirmDelete) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-xs text-slate-500 mr-1">Delete?</span>
        <button
          onClick={() => { onDelete(model.id); setConfirmDelete(false) }}
          className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded transition-colors cursor-pointer"
          title="Confirm delete"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[var(--color-text-primary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-canvas)] rounded transition-colors cursor-pointer"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => onRun(model)}
        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-[var(--color-brand-500)] hover:bg-indigo-50 dark:hover:bg-[var(--color-brand-50)] rounded transition-colors cursor-pointer"
        title="Run model"
      >
        <Play className="w-4 h-4" />
      </button>
      <button
        onClick={() => onEdit(model)}
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
        title="Edit model"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
        title="Delete model"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function ModelRow({ model, onRun, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[var(--color-brand-50)] flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-600 dark:text-[var(--color-brand-500)]">AI</span>
          </div>
          <span className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.name}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.provider}</td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
          model.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-600 dark:text-[var(--color-text-secondary)]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {model.status}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.requests}</td>
      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.latency}</td>
      <td className="px-6 py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.cost}</td>
      <td className="px-6 py-4">
        <ModelRowActions model={model} onRun={onRun} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  )
}

export default function AIModelsPage() {
  const [search, setSearch] = useState('')
  const [data, setData] = useState(models)
  const [toast, setToast] = useState(null)

  const filtered = data.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.provider.toLowerCase().includes(search.toLowerCase())
  )

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleRun = (model) => showToast(`Running ${model.name}...`)
  const handleEdit = (model) => showToast(`Editing ${model.name}`)
  const handleDelete = (id) => {
    const model = data.find(m => m.id === id)
    setData(prev => prev.filter(m => m.id !== id))
    showToast(`${model.name} deleted`)
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">AI Models</h2>
          <p className="text-slate-500 mt-1">Manage and monitor your AI model configurations.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:opacity-90 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)]">
        <div className="p-4 border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Requests</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Latency</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cost</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[var(--color-border-subtle)]">
              {filtered.length > 0 ? filtered.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  onRun={handleRun}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">
                    No models match "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
