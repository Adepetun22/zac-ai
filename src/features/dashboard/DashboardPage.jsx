import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import MetricCard from '../../components/MetricCard';
import ActivityChart from '../../components/ActivityChart';
import UsageChart from '../../components/UsageChart';
import RecentActivity from '../../components/RecentActivity';
import { MessageSquare, Coins, DollarSign, Cpu, LayoutDashboard, Bot, BarChart2, Users, Settings, X, ChevronRight, ChevronLeft } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import { useAIStore } from '../../store/aiStore';
import useAuthStore from '../../store/authStore';

const PAGES = [
  {
    icon: LayoutDashboard,
    color: 'bg-indigo-50 text-indigo-600',
    title: 'Dashboard',
    description: 'Your command center. See total API requests, tokens processed, cost, and active models at a glance. The activity chart and recent conversations update live as you use the platform.',
  },
  {
    icon: Bot,
    color: 'bg-violet-50 text-violet-600',
    title: 'AI Models',
    description: 'Register and manage your AI models. Add a model by selecting a provider, pasting your API key, and choosing a model ID. Registered models appear in the Collaboration chat dropdown automatically.',
  },
  {
    icon: Users,
    color: 'bg-sky-50 text-sky-600',
    title: 'Collaboration',
    description: 'A shared canvas where you and your team can generate charts, tables, and images by chatting with AI. Pick any model from the dropdown, type a prompt, and the result is pinned to the canvas. Invite others with a session code.',
  },
  {
    icon: BarChart2,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Analytics',
    description: 'Visualise your AI usage over time. All data comes from your Collaboration sessions — requests per day, token consumption, and a per-model breakdown showing usage share and response speed.',
  },
  {
    icon: Settings,
    color: 'bg-amber-50 text-amber-600',
    title: 'Settings',
    description: 'Customise your experience. Change your display name, switch between light and dark themes, pick an accent colour, and manage your account preferences.',
  },
];

function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const page = PAGES[step];
  const Icon = page.icon;
  const isLast = step === PAGES.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <img src="/src/assets/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">Welcome to Zac-AI</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {PAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all cursor-pointer ${
                i === step ? 'w-6 h-2 bg-indigo-600' : 'w-2 h-2 bg-slate-200 dark:bg-[var(--color-border-subtle)] hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Page content */}
        <div className="px-6 pb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${page.color}`}>
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-[var(--color-text-primary)] mb-2">{page.title}</h3>
          <p className="text-sm text-slate-500 dark:text-[var(--color-text-secondary)] leading-relaxed">{page.description}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-xs text-slate-400">{step + 1} / {PAGES.length}</span>
          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
            >
              Get started
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [activityRange, setActivityRange] = useState('24h');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('zac-onboarding-seen'); } catch { return false; }
  });

  const dismissOnboarding = () => {
    try { localStorage.setItem('zac-onboarding-seen', 'true'); } catch {}
    setShowOnboarding(false);
  };
  const { 
    analytics,
    isLoading,
    fetchDashboardData,
    fetchAnalytics,
    transformAnalyticsToActivityChart,
    transformAnalyticsToRecentActivity,
    transformModelsToUsageChart,
  } = useDashboardStore();

  // Live metrics from aiStore (updates on every AI request)
  const aiModels = useAIStore(s => s.aiModels);
  const totalApiRequests = aiModels.reduce((sum, m) => sum + (m.api_requests || 0), 0);
  const totalTokensProcessed = aiModels.reduce((sum, m) => sum + (m.tokens_processed || 0), 0);
  const totalCost = aiModels.reduce((sum, m) => sum + (m.cost || 0), 0);
  const activeModels = aiModels.filter(m => m.status === 'active').length;

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
      {showOnboarding && <OnboardingModal onClose={dismissOnboarding} />}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Welcome back, {user?.email || 'User'}. Here's your AI platform overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total API Requests"
          value={formatNumber(totalApiRequests)}
          change={getChangeValue(0)}
          icon={MessageSquare}
          color="indigo"
        />
        <MetricCard
          title="Tokens Processed"
          value={formatNumber(totalTokensProcessed)}
          change={getChangeValue(0)}
          icon={Coins}
          color="blue"
        />
        <MetricCard
          title="Total Cost"
          value={formatCurrency(totalCost)}
          change={getChangeValue(0)}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Active Models"
          value={activeModels.toString()}
          change={getChangeValue(0)}
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
        <RecentActivity />
      </div>
    </div>
  );
}