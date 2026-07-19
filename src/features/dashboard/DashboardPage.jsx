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
    widgets, 
    aiModels, 
    analytics, 
    isLoading, 
    widgetError,
    fetchWidgets, 
    fetchAiModels, 
    fetchAnalytics,
    clearError
  } = useDashboardStore();

  useEffect(() => {
    if (user?.id) {
      // Fetch dashboard data when user is authenticated
      fetchWidgets(user.id);
      fetchAiModels(user.id);
      fetchAnalytics(user.id);
    }
  }, [user?.id, fetchWidgets, fetchAiModels, fetchAnalytics]);

  // Calculate metrics based on fetched data
  const totalApiRequests = widgets.reduce((sum, widget) => sum + (widget.api_requests || 0), 0);
  const totalTokensProcessed = widgets.reduce((sum, widget) => sum + (widget.tokens_processed || 0), 0);
  const totalCost = aiModels.reduce((sum, model) => sum + (model.cost || 0), 0);
  const activeModels = aiModels.length;

  // Format metrics for display
  const formattedApiRequests = totalApiRequests >= 1000000 
    ? `${(totalApiRequests / 1000000).toFixed(1)}M` 
    : totalApiRequests.toString();
  
  const formattedTokensProcessed = totalTokensProcessed >= 1000000 
    ? `${(totalTokensProcessed / 1000000).toFixed(1)}M` 
    : totalTokensProcessed.toString();

  // Handle loading and error states
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
          value={formattedApiRequests}
          change="+12.5%"
          icon={MessageSquare}
          color="indigo"
        />
        <MetricCard
          title="Tokens Processed"
          value={formattedTokensProcessed}
          change="+8.2%"
          icon={Coins}
          color="blue"
        />
        <MetricCard
          title="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          change="-3.1%"
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Active Models"
          value={activeModels.toString()}
          change={`+${aiModels.filter(m => m.status === 'active').length}`}
          icon={Cpu}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ActivityChart data={analytics} />
        </div>
        <div>
          <UsageChart data={analytics} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RecentActivity activities={analytics.slice(0, 5)} />
      </div>
    </div>
  );
}