import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { time: '00:00', requests: 1200 },
  { time: '04:00', requests: 800 },
  { time: '08:00', requests: 2100 },
  { time: '12:00', requests: 3200 },
  { time: '16:00', requests: 2800 },
  { time: '20:00', requests: 2400 },
  { time: '23:59', requests: 1800 },
]

export default function ActivityChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">API Activity</h3>
          <p className="text-sm text-slate-500">Requests per hour today</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-md">24h</button>
          <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-md">7d</button>
          <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-md">30d</button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#1e293b', fontWeight: '600' }}
          />
          <Line
            type="monotone"
            dataKey="requests"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
