import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function UsageChart({ data = [] }) {
  const chartData = data.length > 0 ? data : []

  return (
    <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">Model Usage</h3>
        <p className="text-sm text-slate-500">Distribution by AI model</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {chartData.map((item, index) => (
          <div key={item.name || index} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}></div>
            <span className="text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{item.name}</span>
            <span className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
