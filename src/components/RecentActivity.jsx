import { MessageSquare, Bot } from 'lucide-react'
import { useAIStore } from '../store/aiStore'

export default function RecentActivity() {
  const { conversations, aiModels } = useAIStore()

  // Flatten all conversations into a list of {modelId, modelName, question, answer, index}
  const items = []
  Object.entries(conversations).forEach(([modelId, messages]) => {
    const model = aiModels.find(m => m.id === modelId)
    const modelName = model?.name || modelId
    for (let i = 0; i < messages.length - 1; i += 2) {
      const user = messages[i]
      const assistant = messages[i + 1]
      if (user?.role === 'user') {
        items.push({ key: `${modelId}-${i}`, modelName, question: user.content, answer: assistant?.content || '' })
      }
    }
  })
  // Most recent first (last pushed = most recent)
  items.reverse()
  const recent = items.slice(0, 8)

  return (
    <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">Recent Activity</h3>
        <p className="text-sm text-slate-500">Latest AI model interactions</p>
      </div>

      {recent.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No recent activity — start a conversation in AI Models</div>
      ) : (
        <div className="space-y-3">
          {recent.map((item) => (
            <div key={item.key} className="p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs font-medium text-indigo-600 dark:text-[var(--color-brand-500)] truncate">{item.modelName}</span>
              </div>
              <div className="flex items-start gap-2 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] line-clamp-1">{item.question}</p>
              </div>
              {item.answer && (
                <p className="text-xs text-slate-500 line-clamp-2 ml-5">{item.answer}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
