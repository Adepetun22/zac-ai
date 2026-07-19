import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('week'); // week, month, year
  const { 
    analytics, 
    isLoading, 
    error, 
    fetchAnalytics,
    clearError
  } = useDashboardStore();
  const { user } = useAuthStore();

  // Calculate date range for fetching analytics
  const calculateDateRange = useMemo(() => {
    return () => {
      const today = new Date();
      let startDate = new Date();
      
      switch(dateRange) {
        case 'week':
          startDate.setDate(today.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(today.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(today.getFullYear() - 1);
          break;
        default:
          startDate.setDate(today.getDate() - 7);
      }
      
      return { startDate, endDate: today };
    };
  }, [dateRange]);

  // Fetch analytics data when user is authenticated and date range changes
  useEffect(() => {
    if (user?.id) {
      const { startDate, endDate } = calculateDateRange();
      fetchAnalytics(user.id, startDate, endDate);
    }
  }, [user?.id, dateRange, fetchAnalytics, calculateDateRange]);

  // Prepare data for charts based on fetched analytics
  const prepareWeeklyData = useMemo(() => {
    if (!analytics || analytics.length === 0) {
      // Return mock data if no analytics available
      return [
        { day: 'Mon', requests: 4200, tokens: 28000 },
        { day: 'Tue', requests: 3800, tokens: 24000 },
        { day: 'Wed', requests: 5100, tokens: 34000 },
        { day: 'Thu', requests: 4600, tokens: 31000 },
        { day: 'Fri', requests: 5800, tokens: 39000 },
        { day: 'Sat', requests: 3200, tokens: 21000 },
        { day: 'Sun', requests: 2800, tokens: 18000 },
      ];
    }

    // Group analytics by day and aggregate data
    const groupedData = analytics.reduce((acc, record) => {
      const date = new Date(record.created_at).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { day: date, requests: 0, tokens: 0 };
      }
      acc[date].requests += record.api_requests || 0;
      acc[date].tokens += record.tokens_processed || 0;
      return acc;
    }, {});

    return Object.values(groupedData).slice(0, 7);
  }, [analytics]);

  const prepareModelPerformance = useMemo(() => {
    if (!analytics || analytics.length === 0) {
      // Return mock data if no analytics available
      return [
        { model: 'GPT-4o', accuracy: 94, speed: 87 },
        { model: 'Claude 3.5', accuracy: 92, speed: 82 },
        { model: 'Gemini Pro', accuracy: 88, speed: 95 },
        { model: 'Llama 3', accuracy: 85, speed: 78 },
      ];
    }

    // Calculate model performance from analytics
    const modelStats = analytics.reduce((acc, record) => {
      const modelName = record.model_name || 'Unknown';
      if (!acc[modelName]) {
        acc[modelName] = { model: modelName, accuracy: 0, speed: 0, count: 0 };
      }
      acc[modelName].accuracy += record.accuracy || 0;
      acc[modelName].speed += record.response_time ? 100 - (record.response_time / 10) : 0; // Convert response time to speed score
      acc[modelName].count++;
      return acc;
    }, {});

    return Object.values(modelStats).map(stat => ({
      model: stat.model,
      accuracy: Math.round(stat.accuracy / stat.count) || 0,
      speed: Math.round(stat.speed / stat.count) || 0
    })).slice(0, 4);
  }, [analytics]);

  const weeklyData = prepareWeeklyData;
  const modelPerformance = prepareModelPerformance;

  // Handle loading and error states
  if (isLoading && analytics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
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
              <strong>Error:</strong> {error}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">Analytics</h2>
            <p className="text-slate-500 mt-1">Deep dive into your AI platform performance metrics.</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setDateRange('week')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                dateRange === 'week'
                  ? 'bg-indigo-100 dark:bg-[var(--color-brand-50)] text-indigo-700 dark:text-[var(--color-brand-500)]'
                  : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-700 dark:text-[var(--color-text-secondary)] hover:bg-slate-200 dark:hover:bg-[var(--color-border-subtle)]'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setDateRange('month')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                dateRange === 'month'
                  ? 'bg-indigo-100 dark:bg-[var(--color-brand-50)] text-indigo-700 dark:text-[var(--color-brand-500)]'
                  : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-700 dark:text-[var(--color-text-secondary)] hover:bg-slate-200 dark:hover:bg-[var(--color-border-subtle)]'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setDateRange('year')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                dateRange === 'year'
                  ? 'bg-indigo-100 dark:bg-[var(--color-brand-50)] text-indigo-700 dark:text-[var(--color-brand-500)]'
                  : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-700 dark:text-[var(--color-text-secondary)] hover:bg-slate-200 dark:hover:bg-[var(--color-border-subtle)]'
              }`}
            >
              Year
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Weekly Requests</h3>
          <p className="text-sm text-slate-500 mb-6">API calls over the selected period</p>
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
          <p className="text-sm text-slate-500 mb-6">Token consumption over the selected period</p>
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
  );
}