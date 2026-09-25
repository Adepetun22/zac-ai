import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Shield, Globe, ArrowRight, Menu, X, Sparkles,
  TrendingUp, Clock, DollarSign, Users, CheckCircle2,
  XCircle, Cpu, Lock, BarChart3, Layers,
} from 'lucide-react';
import AnimatedBackground from '../../components/landing/ConstellationGrid';
import ThemeToggle from '../../components/landing/ThemeToggle';

const ADVANTAGES = [
  {
    icon: Zap,
    title: 'Instant visualizations',
    desc: 'Generate charts and tables from prompts in under two seconds. No drag-and-drop builders, no manual data binding.',
    color: 'from-amber-500 to-orange-600',
    detail: 'Our AI parses your intent, selects the optimal chart type, and renders it live — all before you finish reading the response.',
  },
  {
    icon: Shield,
    title: 'Secure by default',
    desc: 'Enterprise-grade auth, row-level security, and encrypted storage keep your data protected at every layer.',
    color: 'from-sky-500 to-blue-600',
    detail: 'Powered by Supabase with RLS policies, OAuth 2.0, magic links, and AES-256 encrypted API key storage.',
  },
  {
    icon: Globe,
    title: 'Any device, any browser',
    desc: 'Responsive design that works on desktop, tablet, and mobile without compromising functionality.',
    color: 'from-violet-500 to-indigo-600',
    detail: 'Built mobile-first with Tailwind CSS. Every feature — including collaboration — works on a 375px screen.',
  },
  {
    icon: TrendingUp,
    title: 'Scales with your team',
    desc: 'From solo analysts to enterprise teams, Zac-AI handles concurrent users, large datasets, and high-frequency queries.',
    color: 'from-emerald-500 to-teal-600',
    detail: 'WebSocket-based real-time sync handles 50ms latency even with dozens of simultaneous collaborators.',
  },
  {
    icon: DollarSign,
    title: 'Transparent cost tracking',
    desc: 'See exactly what each AI query costs across every provider. No surprise bills at the end of the month.',
    color: 'from-green-500 to-emerald-600',
    detail: 'Per-model cost breakdown, daily/weekly/monthly spend charts, and configurable budget alerts.',
  },
  {
    icon: Clock,
    title: 'Zero setup time',
    desc: 'Connect your AI providers, invite your team, and start generating insights in under five minutes.',
    color: 'from-pink-500 to-rose-600',
    detail: 'No infrastructure to manage. No SDK to install. Just paste your API keys and go.',
  },
];

const STATS = [
  { label: 'Latency', value: '< 2s', sub: 'Chart generation' },
  { label: 'Uptime', value: '99.9%', sub: 'Platform SLA' },
  { label: 'Providers', value: '10+', sub: 'AI models unified' },
  { label: 'Sync', value: '50ms', sub: 'Real-time updates' },
  { label: 'Setup', value: '< 5min', sub: 'Time to first chart' },
  { label: 'Security', value: 'RLS', sub: 'Row-level policies' },
];

const COMPARISON = [
  { feature: 'Natural language to chart', zacai: true, others: false },
  { feature: 'Real-time multi-user collaboration', zacai: true, others: false },
  { feature: 'Unified multi-provider AI hub', zacai: true, others: false },
  { feature: 'Built-in cost tracking', zacai: true, others: false },
  { feature: 'Row-level security', zacai: true, others: true },
  { feature: 'Mobile responsive', zacai: true, others: true },
  { feature: 'Streaming AI responses', zacai: true, others: false },
  { feature: 'No-code setup', zacai: true, others: false },
];

export default function AdvantagesPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative z-10 min-h-screen flex flex-col overflow-hidden text-slate-900 dark:text-[var(--color-text-primary)]" style={{ isolation: 'isolate' }}>
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700/60' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/src/assets/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover transition-transform duration-300 group-hover:scale-110" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Zac-AI</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Home</Link>
              <Link to="/features" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Features</Link>
              <Link to="/how-it-works" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">How it works</Link>
              <Link to="/advantages" className="text-sm font-medium text-indigo-600">Advantages</Link>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-slate-900 transition-colors duration-200">Sign in</Link>
              <Link to="/signup" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all duration-200">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="hidden md:flex items-center gap-2"><ThemeToggle /></div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
            <div className="px-4 py-4 space-y-3">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Home</Link>
              <Link to="/features" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Features</Link>
              <Link to="/how-it-works" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">How it works</Link>
              <Link to="/advantages" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-indigo-600 py-2">Advantages</Link>
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-slate-900 py-2">Sign in</Link>
              <div className="pt-2"><ThemeToggle /></div>
              <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="block w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      <AnimatedBackground />

      <section className="flex-1 pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Why teams choose Zac-AI
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Built for speed, scale,{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">and simplicity</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)]">
              Stop switching between five tools to get one answer. Zac-AI unifies your AI stack, your data, and your team in one place.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-20">
            {STATS.map((stat, i) => (
              <div key={stat.label} className="bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl p-4 border border-slate-200 dark:border-[var(--color-border-subtle)] text-center shadow-sm animate-fade-in-up" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-[var(--color-text-secondary)] uppercase tracking-wider mt-0.5">{stat.label}</div>
                <div className="text-xs text-slate-400 dark:text-[var(--color-text-muted)] mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Advantages grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {ADVANTAGES.map((adv, idx) => (
              <div key={adv.title} className="group bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl p-6 border border-slate-200 dark:border-[var(--color-border-subtle)] hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/30 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${idx * 0.08}s` }}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${adv.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <adv.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{adv.title}</h3>
                <p className="text-sm text-slate-600 dark:text-[var(--color-text-primary)] mb-3">{adv.desc}</p>
                <p className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)] leading-relaxed border-t border-slate-100 dark:border-[var(--color-border-subtle)] pt-3">{adv.detail}</p>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="mb-20 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">How we compare</h2>
            <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl border border-slate-200 dark:border-[var(--color-border-subtle)] overflow-hidden">
              <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800/50 px-6 py-3 text-xs font-semibold text-slate-500 dark:text-[var(--color-text-secondary)] uppercase tracking-wider">
                <div>Feature</div>
                <div className="text-center text-indigo-600">Zac-AI</div>
                <div className="text-center">Others</div>
              </div>
              {COMPARISON.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-3 px-6 py-4 items-center ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20'} border-t border-slate-100 dark:border-[var(--color-border-subtle)]`}>
                  <div className="text-sm text-slate-700 dark:text-[var(--color-text-primary)]">{row.feature}</div>
                  <div className="flex justify-center">
                    {row.zacai ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-slate-300" />}
                  </div>
                  <div className="flex justify-center">
                    {row.others ? <CheckCircle2 className="w-5 h-5 text-slate-400" /> : <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center animate-fade-in-up">
            <p className="text-slate-600 dark:text-[var(--color-text-primary)] mb-6 text-lg">Experience the difference yourself — free to start.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/25">
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/features" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] text-slate-700 dark:text-[var(--color-text-primary)] font-semibold hover:border-indigo-300 transition-all duration-200">
                Explore features
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white dark:bg-[var(--color-bg-surface)] border-t border-slate-200 dark:border-[var(--color-border-subtle)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/src/assets/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-slate-900 dark:text-white">Zac-AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
              <Link to="/" className="hover:text-indigo-600 transition-colors duration-200">Home</Link>
              <a href="#" className="hover:text-indigo-600 transition-colors duration-200">Privacy</a>
              <a href="#" className="hover:text-indigo-600 transition-colors duration-200">Terms</a>
              <a href="#" className="hover:text-indigo-600 transition-colors duration-200">Contact</a>
            </div>
            <div className="text-sm text-slate-400 dark:text-[var(--color-text-muted)]">
              &copy; {new Date().getFullYear()} Zac-AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
