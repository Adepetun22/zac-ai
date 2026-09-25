import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Users, LineChart, Image as ImageIcon, Shield, Globe,
  ArrowRight, Menu, X, Sparkles, Zap, Code2, BarChart3,
  RefreshCw, Lock, Smartphone, Cpu, Database, Layers,
  CheckCircle2,
} from 'lucide-react';
import AnimatedBackground from '../../components/landing/ConstellationGrid';
import ThemeToggle from '../../components/landing/ThemeToggle';

const FEATURES = [
  {
    icon: Bot,
    title: 'Natural Language Charts',
    description: 'Type what you need — revenue breakdowns, trend graphs, usage tables — and get polished visualizations instantly.',
    color: 'from-indigo-500 to-purple-600',
    bullets: ['Bar, line, pie & scatter charts', 'Auto-detects chart type from prompt', 'Editable after generation'],
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    description: 'Share dashboards with your team. See live cursors, edits, and comments as they happen.',
    color: 'from-emerald-500 to-teal-600',
    bullets: ['Live cursor tracking per user', 'Shared canvas with drag & drop', 'Invite via session code'],
  },
  {
    icon: LineChart,
    title: 'Unified AI Hub',
    description: 'Manage OpenRouter, OpenAI, Anthropic, Google, and Hugging Face models from one control center.',
    color: 'from-amber-500 to-orange-600',
    bullets: ['10+ providers in one UI', 'Per-model cost tracking', 'Smart routing by query type'],
  },
  {
    icon: ImageIcon,
    title: 'AI Image Generation',
    description: 'Generate visuals directly inside your workflow with Hugging Face and image-capable models.',
    color: 'from-pink-500 to-rose-600',
    bullets: ['Text-to-image in the dashboard', 'Multiple style presets', 'Download & embed anywhere'],
  },
  {
    icon: Shield,
    title: 'Enterprise-Ready Security',
    description: 'Supabase auth, row-level security, and encrypted storage keep your data protected.',
    color: 'from-sky-500 to-blue-600',
    bullets: ['Row-level security policies', 'OAuth & magic link auth', 'Encrypted API key storage'],
  },
  {
    icon: Globe,
    title: 'Works Everywhere',
    description: 'Responsive across desktop, tablet, and mobile. Access insights on any device.',
    color: 'from-violet-500 to-indigo-600',
    bullets: ['Mobile-first responsive layout', 'PWA-ready architecture', 'Cross-browser compatible'],
  },
  {
    icon: Code2,
    title: 'Code Generation',
    description: 'Ask for SQL queries, Python scripts, or API snippets and get production-ready code instantly.',
    color: 'from-cyan-500 to-blue-600',
    bullets: ['SQL, Python, JS & more', 'Syntax-highlighted output', 'Copy with one click'],
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Monitor model usage, API costs, and team activity with built-in analytics.',
    color: 'from-fuchsia-500 to-pink-600',
    bullets: ['Usage heatmaps & trends', 'Cost breakdown per model', 'Team activity feed'],
  },
  {
    icon: RefreshCw,
    title: 'Streaming Responses',
    description: 'AI responses render in real-time as they stream in — no waiting for the full reply.',
    color: 'from-green-500 to-emerald-600',
    bullets: ['Chunked token rendering', 'Cancel mid-stream', 'Smooth progressive display'],
  },
];

const HIGHLIGHTS = [
  { icon: Cpu, label: '10+ AI Models', sub: 'All in one place' },
  { icon: Zap, label: '< 2s', sub: 'Chart generation' },
  { icon: Database, label: '99.9%', sub: 'Uptime SLA' },
  { icon: Layers, label: '50ms', sub: 'Real-time sync' },
];

export default function FeaturesPage() {
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
              <Link to="/features" className="text-sm font-medium text-indigo-600">Features</Link>
              <Link to="/how-it-works" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">How it works</Link>
              <Link to="/advantages" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Advantages</Link>
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
              <Link to="/features" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-indigo-600 py-2">Features</Link>
              <Link to="/how-it-works" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">How it works</Link>
              <Link to="/advantages" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Advantages</Link>
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
              <Sparkles className="w-3.5 h-3.5" /> 9 powerful features
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Everything you need to ship{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">AI-powered insights</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)]">
              From natural language charts to real-time collaboration, Zac-AI gives your team a single source of truth.
            </p>
          </div>

          {/* Stat highlights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {HIGHLIGHTS.map((h, i) => (
              <div key={h.label} className="bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl p-4 border border-slate-200 dark:border-[var(--color-border-subtle)] text-center animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-2">
                  <h.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">{h.label}</div>
                <div className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">{h.sub}</div>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => (
              <div
                key={feature.title}
                className="group bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl p-6 border border-slate-200 dark:border-[var(--color-border-subtle)] hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/30 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.07}s` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-[var(--color-text-primary)] leading-relaxed text-sm mb-4">{feature.description}</p>
                <ul className="space-y-1.5">
                  {feature.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-20 text-center animate-fade-in-up">
            <p className="text-slate-600 dark:text-[var(--color-text-primary)] mb-6 text-lg">Ready to put these features to work?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/25">
                Start for free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/how-it-works" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] text-slate-700 dark:text-[var(--color-text-primary)] font-semibold hover:border-indigo-300 transition-all duration-200">
                See how it works
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
