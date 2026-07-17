import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const weeklyData = [
  { day: 'Mon', requests: 4200, tokens: 28000 },
  { day: 'Tue', requests: 3800, tokens: 24000 },
  { day: 'Wed', requests: 5100, tokens: 34000 },
  { day: 'Thu', requests: 4600, tokens: 31000 },
  { day: 'Fri', requests: 5800, tokens: 39000 },
  { day: 'Sat', requests: 3200, tokens: 21000 },
  { day: 'Sun', requests: 2800, tokens: 18000 },
]

const modelPerformance = [
  { model: 'GPT-4o', accuracy: 94, speed: 87 },
  { model: 'Claude 3.5', accuracy: 92, speed: 82 },
  { model: 'Gemini Pro', accuracy: 88, speed: 95 },
  { model: 'Llama 3', accuracy: 85, speed: 78 },
]

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">Analytics</h2>
        <p className="text-slate-500 mt-1">Deep dive into your AI platform performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Weekly Requests</h3>
          <p className="text-sm text-slate-500 mb-6">API calls over the last 7 days</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: 'var(--color-text-primary)', fontWeight: '600' }}
              />
              <Bar dataKey="requests" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Token Usage Trend</h3>
          <p className="text-sm text-slate-500 mb-6">Daily token consumption</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: 'var(--color-text-primary)', fontWeight: '600' }}
              />
              <Line type="monotone" dataKey="tokens" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Model Performance</h3>
        <p className="text-sm text-slate-500 mb-6">Accuracy and speed comparison</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modelPerformance.map((item) => (
            <div key={item.model} className="p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
              <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] mb-3">{item.model}</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Accuracy</span>
                    <span className="font-medium text-slate-700 dark:text-[var(--color-text-primary)]">{item.accuracy}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-[var(--color-border-subtle)] rounded-full h-1.5">
                    <div className="bg-indigo-500 dark:bg-[var(--color-brand-500)] h-1.5 rounded-full" style={{ width: `${item.accuracy}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Speed</span>
                    <span className="font-medium text-slate-700 dark:text-[var(--color-text-primary)]">{item.speed}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-[var(--color-border-subtle)] rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${item.speed}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
