import MetricCard from '../../components/MetricCard'
import ActivityChart from '../../components/ActivityChart'
import UsageChart from '../../components/UsageChart'
import RecentActivity from '../../components/RecentActivity'
import { MessageSquare, Coins, DollarSign, Cpu } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Welcome back, Zac. Here's your AI platform overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total API Requests"
          value="1.2M"
          change="+12.5%"
          icon={MessageSquare}
          color="indigo"
        />
        <MetricCard
          title="Tokens Processed"
          value="8.4M"
          change="+8.2%"
          icon={Coins}
          color="blue"
        />
        <MetricCard
          title="Total Cost"
          value="$1,247"
          change="-3.1%"
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Active Models"
          value="12"
          change="+2"
          icon={Cpu}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ActivityChart />
        </div>
        <div>
          <UsageChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RecentActivity />
      </div>
    </div>
  )
}
