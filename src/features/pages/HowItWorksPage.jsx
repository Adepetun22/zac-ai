import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Menu, X, Sparkles, Plug, MessageSquare,
  Share2, ChevronDown, ChevronUp, CheckCircle2, Zap,
  Users, BarChart3, Key, Bell, Play,
} from 'lucide-react';
import AnimatedBackground from '../../components/landing/ConstellationGrid';
import ThemeToggle from '../../components/landing/ThemeToggle';

const STEPS = [
  {
    step: '01',
    icon: Plug,
    title: 'Connect your stack',
    description: 'Link your AI providers and invite your team in seconds. No infrastructure setup required.',
    color: 'from-indigo-500 to-purple-600',
    substeps: [
      { icon: Key, text: 'Paste your OpenRouter, Google, or Hugging Face API keys' },
      { icon: Users, text: 'Invite teammates via email or shareable link' },
      { icon: Bell, text: 'Configure budget alerts and usage limits' },
    ],
  },
  {
    step: '02',
    icon: MessageSquare,
    title: 'Prompt your dashboard',
    description: 'Ask for charts, tables, or insights in plain English. Zac-AI picks the right model and visualization automatically.',
    color: 'from-emerald-500 to-teal-600',
    substeps: [
      { icon: BarChart3, text: 'Type "show me Q3 revenue by region as a bar chart"' },
      { icon: Zap, text: 'AI selects the best model and chart type for your query' },
      { icon: CheckCircle2, text: 'Visualization renders in under 2 seconds' },
    ],
  },
  {
    step: '03',
    icon: Share2,
    title: 'Collaborate & ship',
    description: 'Edit together in real time, share results with stakeholders, and make decisions faster than ever.',
    color: 'from-amber-500 to-orange-600',
    substeps: [
      { icon: Users, text: 'See live cursors and edits from teammates' },
      { icon: BarChart3, text: 'Drag, resize, and rearrange widgets on the shared canvas' },
      { icon: Share2, text: 'Export or share a live link to your dashboard' },
    ],
  },
];

const FAQS = [
  {
    q: 'Do I need to know how to code?',
    a: 'No. Zac-AI is designed for everyone — analysts, product managers, and executives. If you can type a question, you can build a dashboard.',
  },
  {
    q: 'Which AI providers are supported?',
    a: 'We support OpenRouter (Gemma, GPT, Llama, Mistral, Cohere), Google Gemini, Anthropic Claude, and Hugging Face image models. More are added regularly.',
  },
  {
    q: 'How does real-time collaboration work?',
    a: 'We use WebSockets and Supabase Realtime to sync cursor positions, widget changes, and new charts across all connected users with ~50ms latency.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. API keys are encrypted at rest, all traffic is TLS-encrypted, and Supabase row-level security ensures users only see data they are authorized to access.',
  },
  {
    q: 'Can I use my own API keys?',
    a: 'Absolutely. You bring your own keys for each provider. Zac-AI acts as a secure proxy — your keys are never exposed to the frontend.',
  },
  {
    q: 'Is there a free tier?',
    a: 'Yes. You can start for free with your own API keys. There are no platform fees to get started — you only pay your AI provider for usage.',
  },
];

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white dark:bg-[var(--color-bg-surface)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200"
      >
        <span className="font-semibold text-slate-900 dark:text-white text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-indigo-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-4 bg-white dark:bg-[var(--color-bg-surface)] text-sm text-slate-600 dark:text-[var(--color-text-primary)] leading-relaxed border-t border-slate-100 dark:border-[var(--color-border-subtle)] pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function HowItWorksPage() {
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
              <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover transition-transform duration-300 group-hover:scale-110" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Zac-AI</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Home</Link>
              <Link to="/features" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Features</Link>
              <Link to="/how-it-works" className="text-sm font-medium text-indigo-600">How it works</Link>
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
              <Link to="/features" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Features</Link>
              <Link to="/how-it-works" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-indigo-600 py-2">How it works</Link>
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
          <div className="text-center max-w-3xl mx-auto mb-20 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-4">
              <Play className="w-3.5 h-3.5" /> Up and running in minutes
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              From zero to live dashboard{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">in three steps</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)]">
              No infrastructure to manage. No SDK to install. Just connect, prompt, and collaborate.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-8 mb-24">
            {STEPS.map((item, idx) => (
              <div key={item.step} className="group bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl border border-slate-200 dark:border-[var(--color-border-subtle)] hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-100/40 dark:hover:shadow-indigo-900/30 transition-all duration-300 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 0.15}s` }}>
                <div className="flex flex-col md:flex-row">
                  {/* Step number + icon */}
                  <div className={`flex-shrink-0 bg-gradient-to-br ${item.color} p-8 flex flex-col items-center justify-center gap-3 md:w-48`}>
                    <span className="text-5xl font-extrabold text-white/30 leading-none">{item.step}</span>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6 md:p-8">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                    <p className="text-slate-600 dark:text-[var(--color-text-primary)] mb-6 leading-relaxed">{item.description}</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {item.substeps.map((sub, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-[var(--color-border-subtle)]">
                          <sub.icon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-600 dark:text-[var(--color-text-primary)] leading-relaxed">{sub.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline summary */}
          <div className="mb-24 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-10">Your first 5 minutes with Zac-AI</h2>
            <div className="relative">
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 dark:bg-[var(--color-border-subtle)] -translate-x-1/2" />
              {[
                { time: '0:00', title: 'Sign up', desc: 'Create your account with email or Google OAuth.' },
                { time: '0:30', title: 'Add API keys', desc: 'Paste your OpenRouter or Google AI key into settings.' },
                { time: '1:00', title: 'First prompt', desc: 'Type "show me a bar chart of monthly sales" and watch it render.' },
                { time: '2:00', title: 'Invite a teammate', desc: 'Share your session link and collaborate in real time.' },
                { time: '5:00', title: 'Ship your dashboard', desc: 'Export or share a live link with stakeholders.' },
              ].map((t, i) => (
                <div key={t.time} className={`flex items-center gap-6 mb-6 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  <div className={`flex-1 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <div className="inline-block bg-white dark:bg-[var(--color-bg-surface)] rounded-xl p-4 border border-slate-200 dark:border-[var(--color-border-subtle)] shadow-sm">
                      <div className="text-xs font-semibold text-indigo-600 mb-1">{t.time}</div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{t.title}</div>
                      <div className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)] mt-0.5">{t.desc}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-slate-900 shadow z-10 hidden md:block" />
                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-20 animate-fade-in-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">Frequently asked questions</h2>
            <div className="max-w-3xl mx-auto space-y-3">
              {FAQS.map((faq) => <FAQ key={faq.q} {...faq} />)}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center animate-fade-in-up">
            <p className="text-slate-600 dark:text-[var(--color-text-primary)] mb-6 text-lg">Still have questions? Just start — it's free.</p>
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
              <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
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
