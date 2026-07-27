import { useEffect } from 'react';
import MetricCard from '../../components/MetricCard';
import ActivityChart from '../../components/ActivityChart';
import UsageChart from '../../components/UsageChart';
import RecentActivity from '../../components/RecentActivity';
import { MessageSquare, Coins, DollarSign, Cpu } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { 
    aiModels, 
    analytics, 
    isLoading, 
    widgetError,
    metrics,
    fetchDashboardData,
    clearError,
    transformAnalyticsToActivityChart,
    transformAnalyticsToRecentActivity,
    transformModelsToUsageChart,
    computeMetrics
  } = useDashboardStore();

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id);
    }
  }, [user?.id, fetchDashboardData]);

  useEffect(() => {
    computeMetrics()
  }, [aiModels, computeMetrics])

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

  if (widgetError) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              <strong>Error:</strong> {widgetError}
              <button 
                onClick={clearError}
                className="ml-4 text-sm font-medium text-red-700 underline"
              >
                Dismiss
              </button>
            </p>
          </div>
        </div>
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
          <ActivityChart data={activityChartData} />
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