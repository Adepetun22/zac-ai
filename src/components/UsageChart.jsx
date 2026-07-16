import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const data = [
  { name: 'GPT-4o', value: 45, color: '#6366f1' },
  { name: 'Claude 3.5', value: 25, color: '#10b981' },
  { name: 'Gemini Pro', value: 20, color: '#f59e0b' },
  { name: 'Llama 3', value: 10, color: '#ef4444' },
]

export default function UsageChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Model Usage</h3>
        <p className="text-sm text-slate-500">Distribution by AI model</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
            <span className="text-sm text-slate-600">{item.name}</span>
            <span className="text-sm font-medium text-slate-900 ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
