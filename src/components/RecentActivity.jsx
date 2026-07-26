import { MoreHorizontal, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Completed' },
  processing: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Processing' },
  failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
}

export default function RecentActivity({ activities = [] }) {
  return (
    <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">Recent Activity</h3>
          <p className="text-sm text-slate-500">Latest AI model interactions</p>
        </div>
        <button className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-[var(--color-brand-500)] dark:hover:text-[var(--color-brand-700)] font-medium">View all</button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No recent activity</div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const status = statusConfig[activity.status] || statusConfig.completed
            const StatusIcon = status.icon
            return (
              <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg hover:bg-slate-100 dark:hover:bg-[var(--color-border-subtle)] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${status.bg}`}>
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{activity.prompt || activity.model || 'AI Request'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{activity.model || ''} {activity.tokens ? `• ${activity.tokens.toLocaleString()} tokens` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{activity.time || 'recently'}</span>
                  <button className="p-1 hover:bg-slate-200 dark:hover:bg-[var(--color-border-strong)] rounded transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
