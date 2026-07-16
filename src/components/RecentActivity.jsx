import { MoreHorizontal, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

const activities = [
  { id: 1, model: 'GPT-4o', prompt: 'Analyze customer feedback data', status: 'completed', tokens: 1247, time: '2 min ago' },
  { id: 2, model: 'Claude 3.5', prompt: 'Generate product description', status: 'completed', tokens: 856, time: '5 min ago' },
  { id: 3, model: 'Gemini Pro', prompt: 'Summarize research paper', status: 'processing', tokens: 2100, time: '1 min ago' },
  { id: 4, model: 'Llama 3', prompt: 'Code review and optimization', status: 'failed', tokens: 432, time: '12 min ago' },
  { id: 5, model: 'GPT-4o', prompt: 'Translate documentation', status: 'completed', tokens: 1567, time: '18 min ago' },
]

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Completed' },
  processing: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Processing' },
  failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
}

export default function RecentActivity() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
          <p className="text-sm text-slate-500">Latest AI model interactions</p>
        </div>
        <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View all</button>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => {
          const status = statusConfig[activity.status]
          const StatusIcon = status.icon
          return (
            <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${status.bg}`}>
                  <StatusIcon className={`w-4 h-4 ${status.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{activity.prompt}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{activity.model} • {activity.tokens.toLocaleString()} tokens</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{activity.time}</span>
                <button className="p-1 hover:bg-slate-200 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
