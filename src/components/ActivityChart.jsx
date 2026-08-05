import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ActivityChart({ data = [], onRangeChange, activeRange = '24h' }) {
  const chartData = data.length > 0 ? data : []
  const ranges = ['24h', '7d', '30d']

  return (
    <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">API Activity</h3>
          <p className="text-sm text-slate-500">Requests per hour today</p>
        </div>
        <div className="flex gap-2">
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange?.(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                activeRange === r
                  ? 'bg-indigo-50 dark:bg-[var(--color-brand-50)] text-indigo-600 dark:text-[var(--color-brand-500)]'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)]'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
          <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: 'var(--color-text-primary)', fontWeight: '600' }}
          />
          <Line
            type="monotone"
            dataKey="requests"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-brand-500)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: 'var(--color-brand-500)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
