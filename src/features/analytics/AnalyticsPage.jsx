import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAIStore } from '../../store/aiStore';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('week');
  const { aiModels, conversations } = useAIStore();

  // Build per-day request + token data from conversations
  const chartData = useMemo(() => {
    const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 365;
    const buckets = {};

    // Initialise empty buckets for the range
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets[key] = { day: key, requests: 0, tokens: 0 };
    }

    // Each conversation pair (user+assistant) = 1 request
    // We don't store timestamps per message, so distribute evenly across today
    // and accumulate totals from aiModels for the chart
    const totalRequests = aiModels.reduce((s, m) => s + (m.api_requests || 0), 0);
    const totalTokens = aiModels.reduce((s, m) => s + (m.tokens_processed || 0), 0);

    // Put all accumulated data on today's bucket
    const todayKey = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (buckets[todayKey]) {
      buckets[todayKey].requests = totalRequests;
      buckets[todayKey].tokens = totalTokens;
    }

    return Object.values(buckets);
  }, [aiModels, conversations, dateRange]);

  // Model performance: use real api_requests as usage score, latency for speed
  const modelPerformance = useMemo(() => {
    const userModels = aiModels.filter(m => !m.isBuiltIn && m.api_requests > 0);
    const builtInUsed = aiModels.filter(m => m.isBuiltIn && m.api_requests > 0);
    const display = [...userModels, ...builtInUsed].slice(0, 8);

    if (display.length === 0) return [];

    const maxReqs = Math.max(...display.map(m => m.api_requests || 1));
    return display.map(m => ({
      model: m.name,
      requests: m.api_requests || 0,
      usage: Math.round(((m.api_requests || 0) / maxReqs) * 100),
      speed: m.latency ? Math.max(5, Math.round(100 - (m.latency / 50))) : 80,
      tokens: m.tokens_processed || 0,
    }));
  }, [aiModels]);

  // Summary stats
  const totalRequests = aiModels.reduce((s, m) => s + (m.api_requests || 0), 0);
  const totalTokens = aiModels.reduce((s, m) => s + (m.tokens_processed || 0), 0);
  const totalConversations = Object.values(conversations).reduce((s, msgs) => s + Math.floor(msgs.length / 2), 0);
  const activeModels = aiModels.filter(m => m.api_requests > 0).length;

  const btnCls = (range) =>
    `px-3 py-1.5 text-sm rounded-md ${dateRange === range
      ? 'bg-indigo-100 dark:bg-[var(--color-brand-50)] text-indigo-700 dark:text-[var(--color-brand-500)]'
      : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-700 dark:text-[var(--color-text-secondary)] hover:bg-slate-200 dark:hover:bg-[var(--color-border-subtle)]'}`;

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">Analytics</h2>
            <p className="text-slate-500 mt-1">AI usage data from your Collaboration sessions.</p>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setDateRange('week')} className={btnCls('week')}>Week</button>
            <button onClick={() => setDateRange('month')} className={btnCls('month')}>Month</button>
            <button onClick={() => setDateRange('year')} className={btnCls('year')}>Year</button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Requests', value: totalRequests.toLocaleString() },
          { label: 'Tokens Processed', value: totalTokens.toLocaleString() },
          { label: 'Conversations', value: totalConversations.toLocaleString() },
          { label: 'Models Used', value: activeModels.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)] mt-1">{value}</p>
          </div>
        ))}
      </div>

      {totalRequests === 0 ? (
        <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-12 text-center">
          <p className="text-slate-500 text-sm">No data yet — start chatting in the Collaboration page to see analytics here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">API Requests</h3>
              <p className="text-sm text-slate-500 mb-6">Requests over the selected period</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                  <Bar dataKey="requests" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Token Usage</h3>
              <p className="text-sm text-slate-500 mb-6">Token consumption over the selected period</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                  <Line type="monotone" dataKey="tokens" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)] mb-1">Model Usage</h3>
            <p className="text-sm text-slate-500 mb-6">Requests and speed per model</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {modelPerformance.map((item) => (
                <div key={item.model} className="p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
                  <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] mb-1 truncate">{item.model}</p>
                  <p className="text-xs text-slate-400 mb-3">{item.requests} requests · {item.tokens.toLocaleString()} tokens</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Usage</span>
                        <span className="font-medium text-slate-700 dark:text-[var(--color-text-primary)]">{item.usage}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[var(--color-border-subtle)] rounded-full h-1.5">
                        <div className="bg-indigo-500 dark:bg-[var(--color-brand-500)] h-1.5 rounded-full" style={{ width: `${item.usage}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Speed</span>
                        <span className="font-medium text-slate-700 dark:text-[var(--color-text-primary)]">{item.speed}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[var(--color-border-subtle)] rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${item.speed}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
