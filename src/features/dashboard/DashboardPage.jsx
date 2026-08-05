import { useEffect, useState, useCallback } from 'react';
import MetricCard from '../../components/MetricCard';
import ActivityChart from '../../components/ActivityChart';
import UsageChart from '../../components/UsageChart';
import RecentActivity from '../../components/RecentActivity';
import { MessageSquare, Coins, DollarSign, Cpu } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [activityRange, setActivityRange] = useState('24h');
  const { 
    aiModels, 
    analytics, 
    isLoading,
    metrics,
    fetchDashboardData,
    fetchAnalytics,
    transformAnalyticsToActivityChart,
    transformAnalyticsToRecentActivity,
    transformModelsToUsageChart,
  } = useDashboardStore();

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id);
    }
  }, [user?.id, fetchDashboardData]);

  const handleRangeChange = useCallback((range) => {
    setActivityRange(range);
    if (!user?.id) return;
    const today = new Date();
    const start = new Date();
    if (range === '7d') start.setDate(today.getDate() - 7);
    else if (range === '30d') start.setDate(today.getDate() - 30);
    else start.setDate(today.getDate() - 1);
    fetchAnalytics(user.id, start, today);
  }, [user?.id, fetchAnalytics]);

  const activityChartData = transformAnalyticsToActivityChart(analytics)
  const usageChartData = transformModelsToUsageChart(aiModels)
  const recentActivities = transformAnalyticsToRecentActivity(analytics, aiModels)

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatCurrency = (num) => `$${num.toFixed(2)}`

  const getChangeValue = (change) => {
    if (change > 0) return `+${change.toFixed(1)}%`
    if (change < 0) return `${change.toFixed(1)}%`
    return '0.0%'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Welcome back, {user?.email || 'User'}. Here's your AI platform overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total API Requests"
          value={formatNumber(metrics.totalApiRequests)}
          change={getChangeValue(metrics.apiRequestChange)}
          icon={MessageSquare}
          color="indigo"
        />
        <MetricCard
          title="Tokens Processed"
          value={formatNumber(metrics.totalTokensProcessed)}
          change={getChangeValue(metrics.tokensChange)}
          icon={Coins}
          color="blue"
        />
        <MetricCard
          title="Total Cost"
          value={formatCurrency(metrics.totalCost)}
          change={getChangeValue(metrics.costChange)}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Active Models"
          value={metrics.activeModels.toString()}
          change={getChangeValue(metrics.modelChange)}
          icon={Cpu}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ActivityChart data={activityChartData} onRangeChange={handleRangeChange} activeRange={activityRange} />
        </div>
        <div>
          <UsageChart data={usageChartData} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RecentActivity activities={recentActivities} />
      </div>
    </div>
  );
}