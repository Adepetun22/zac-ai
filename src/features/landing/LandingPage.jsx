import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Bot,
  BarChart3,
  Users,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Play,
  Menu,
  X,
  Sparkles,
  LineChart,
  Image as ImageIcon,
  ChevronRight,
} from 'lucide-react';
import AnimatedBackground from '../../components/landing/ConstellationGrid';
import ThemeToggle from '../../components/landing/ThemeToggle';

const HERO_IMAGES = {
  main: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&q=80',
  charts: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
  collab: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  aiHub: 'https://images.unsplash.com/photo-1677442136019-21780ecbd995?w=800&q=80',
};

const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Advantages', href: '/advantages' },
];

const FEATURES = [
  {
    icon: Bot,
    title: 'Natural Language Charts',
    description: 'Type what you need — revenue breakdowns, trend graphs, usage tables — and get polished visualizations instantly.',
    color: 'from-indigo-500 to-purple-600',
    image: HERO_IMAGES.charts,
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    description: 'Share dashboards with your team. See live cursors, edits, and comments as they happen.',
    color: 'from-emerald-500 to-teal-600',
    image: HERO_IMAGES.collab,
  },
  {
    icon: LineChart,
    title: 'Unified AI Hub',
    description: 'Manage OpenRouter, OpenAI, Anthropic, Google, and Hugging Face models from one control center.',
    color: 'from-amber-500 to-orange-600',
    image: HERO_IMAGES.aiHub,
  },
  {
    icon: ImageIcon,
    title: 'AI Image Generation',
    description: 'Generate visuals directly inside your workflow with Hugging Face and image-capable models.',
    color: 'from-pink-500 to-rose-600',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
  },
  {
    icon: Shield,
    title: 'Enterprise-Ready Security',
    description: 'Supabase auth, row-level security, and encrypted storage keep your data protected.',
    color: 'from-sky-500 to-blue-600',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f2?w=800&q=80',
  },
  {
    icon: Globe,
    title: 'Works Everywhere',
    description: 'Responsive across desktop, tablet, and mobile. Access insights on any device.',
    color: 'from-violet-500 to-indigo-600',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80',
  },
];

const STEPS = [
  { step: '01', title: 'Connect your data', description: 'Link your AI providers and invite your team in seconds.' },
  { step: '02', title: 'Prompt your dashboard', description: 'Ask for charts, tables, or insights in plain English.' },
  { step: '03', title: 'Collaborate & ship', description: 'Edit together, share results, and make decisions faster.' },
];

const STATS = [
  { value: '10+', label: 'AI providers' },
  { value: '<2s', label: 'Avg. chart generation' },
  { value: '99.9%', label: 'Uptime target' },
  { value: '50ms', label: 'Real-time sync' },
];

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {children}
    </motion.div>
  );
}

function ScaleIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative z-10 min-h-screen overflow-hidden text-slate-900 dark:text-[var(--color-text-primary)]" style={{ isolation: 'isolate', touchAction: 'pan-y' }}>
      {/* Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700/60' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
              </motion.div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Zac-AI
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Link to="/" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200">Home</Link>
              </motion.div>
              {NAV_LINKS.map((link, idx) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + idx * 0.05 }}
                >
                  <Link
                    to={link.href}
                    className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-slate-900 transition-colors duration-200"
                >
                  Sign in
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 }}
              >
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
            </div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-3">
                <Link to="/" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Home</Link>
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-slate-900 py-2"
                >
                  Sign in
                </Link>
                <div className="pt-2">
                  <ThemeToggle />
                </div>
                <Link
                  to="/signup"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <AnimatedBackground />

      {/* Hero */}
      <section className="relative pt-24 pb-16 lg:pt-28 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={HERO_IMAGES.main}
            alt="AI dashboard background"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.6, 0.8, 0.6],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-20 left-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
          />
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              className="max-w-2xl"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Now in public beta
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6"
              >
                Your AI workspace for{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] animate-gradient">
                  data & collaboration
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7 }}
                className="text-lg sm:text-xl text-slate-600 dark:text-[var(--color-text-primary)] leading-relaxed mb-8"
              >
                Turn natural language into live dashboards, manage every AI model in one place, and collaborate with your team in real time.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/25"
                >
                  Start building free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                >
                  <Play className="w-4 h-4" />
                  Watch demo
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="mt-10 flex items-center gap-6 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  SOC 2 ready
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  No credit card required
                </div>
              </motion.div>
            </motion.div>

            {/* Hero visual */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative lg:h-[500px] flex items-center justify-center"
            >
              <div className="relative w-full max-w-lg mx-4 sm:mx-0">
                <motion.div
                  animate={{
                    scale: [1, 1.02, 1],
                    opacity: [0.2, 0.35, 0.2],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-2xl sm:-inset-4"
                />
                <motion.div
                  initial={{ rotate: 2, y: 20 }}
                  animate={{ rotate: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  whileHover={{ rotate: 0, y: -5 }}
                  className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-6 transition-transform duration-500"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <div className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-500 dark:text-[var(--color-text-secondary)] font-mono">
                      dashboard.ai
                    </div>
                  </div>

                  <div className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100"
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">AI Assistant</div>
                        <div className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">Show me Q3 revenue breakdown</div>
                      </div>
                    </motion.div>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)] mb-2">Revenue</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">$128K</div>
                        <div className="mt-2 h-12 flex items-end gap-1">
                          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                            <motion.div
                              key={i}
                              className="flex-1 bg-indigo-500 rounded-t"
                              initial={{ height: 0 }}
                              animate={{ height: `${h}%` }}
                              transition={{ delay: 0.8 + i * 0.05, duration: 0.4 }}
                            />
                          ))}
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.75 }}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)] mb-2">Users</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">2,847</div>
                        <div className="mt-2 flex items-center gap-1">
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.9 + i * 0.1, type: 'spring' }}
                              >
                                {i}
                              </motion.div>
                            ))}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)] ml-1">+3 live</span>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating elements */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-6 -right-6 bg-white rounded-xl shadow-lg border border-slate-200 p-3 hidden sm:block"
                >
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-slate-200 p-3 hidden sm:block"
                >
                  <Users className="w-6 h-6 text-emerald-600" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trusted by / marquee */}
      <section className="border-y border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-surface)] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold text-slate-400 dark:text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            Trusted by teams at
          </p>
          <div className="relative overflow-hidden">
            <motion.div
              className="flex animate-marquee whitespace-nowrap"
              animate={{ x: [0, -50 + '%'] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-12 mx-6 text-slate-400 dark:text-[var(--color-text-muted)] font-semibold text-lg">
                  <span>Acme Corp</span>
                  <span>Globex</span>
                  <span>Initech</span>
                  <span>Hooli</span>
                  <span>Vehement</span>
                  <span>Massive Dynamic</span>
                  <span>Stark Industries</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything you need to ship AI-powered insights
            </h2>
            <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)]">
              From natural language charts to real-time collaboration, Zac-AI gives your team a single source of truth.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => (
              <ScaleIn key={feature.title} delay={idx * 0.1}>
                <div className="group relative bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl border border-slate-200 dark:border-[var(--color-border-subtle)] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 h-full">
                  {feature.image && (
                    <div className="absolute inset-0 -z-0">
                      <img
                        src={feature.image}
                        alt=""
                        className="w-full h-full object-cover opacity-10 group-hover:opacity-15 transition-opacity duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/95 to-white dark:from-slate-900/80 dark:via-slate-900/95 dark:to-slate-900" />
                    </div>
                  )}
                  <div className="relative z-10 p-6">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}
                    >
                      <feature.icon className="w-6 h-6 text-white" />
                    </motion.div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                      <p className="text-slate-600 dark:text-[var(--color-text-primary)] leading-relaxed text-sm">{feature.description}</p>
                  </div>
                </div>
              </ScaleIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white dark:bg-[var(--color-bg-surface)] border-y border-slate-200 dark:border-[var(--color-border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)]">
              Go from zero to a live, collaborative AI dashboard in three simple steps.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((item, idx) => (
              <ScaleIn key={item.step} delay={idx * 0.15}>
                <div className="relative text-center">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-6"
                  >
                    <span className="text-2xl font-extrabold text-indigo-600">{item.step}</span>
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-slate-600 dark:text-[var(--color-text-primary)] text-sm leading-relaxed">{item.description}</p>
                  {idx < STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-slate-200" />
                  )}
                </div>
              </ScaleIn>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section id="advantages" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeIn>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6">
                Built for speed, scale, and simplicity
              </h2>
              <p className="text-lg text-slate-600 dark:text-[var(--color-text-primary)] mb-8">
                Stop switching between five tools to get one answer. Zac-AI unifies your AI stack, your data, and your team in one place.
              </p>

              <div className="space-y-6">
                {[
                  { icon: Zap, title: 'Instant visualizations', desc: 'Generate charts and tables from prompts in under two seconds.' },
                  { icon: Shield, title: 'Secure by default', desc: 'Enterprise-grade auth, row-level security, and encrypted storage.' },
                  { icon: Globe, title: 'Any device, any browser', desc: 'Responsive design that works on desktop, tablet, and mobile.' },
                ].map((adv, idx) => (
                  <div
                    key={adv.title}
                    className="flex gap-4"
                    style={{ opacity: 1, transform: 'none' }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                      <adv.icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{adv.title}</h4>
                      <p className="text-sm text-slate-600 dark:text-[var(--color-text-primary)]">{adv.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>

            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Latency', value: '< 2s', sub: 'Chart generation' },
                  { label: 'Uptime', value: '99.9%', sub: 'Platform SLA' },
                  { label: 'Providers', value: '10+', sub: 'AI models unified' },
                  { label: 'Sync', value: '50ms', sub: 'Real-time updates' },
                ].map((stat, i) => (
                  <ScaleIn key={stat.label} delay={i * 0.1}>
                    <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-2xl p-5 border border-slate-200 dark:border-[var(--color-border-subtle)] shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="text-xs font-semibold text-slate-500 dark:text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                        {stat.label}
                      </div>
                      <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[var(--color-text-secondary)] mt-1">{stat.sub}</div>
                    </div>
                  </ScaleIn>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Execution / Stats */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600 rounded-full blur-3xl"
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Execution that scales with you
            </h2>
            <p className="text-lg text-slate-300">
              From prototype to production, our infrastructure keeps your dashboards fast, reliable, and always available.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((stat, idx) => (
              <ScaleIn key={stat.label} delay={idx * 0.1}>
                <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
                  <div className="text-4xl font-extrabold text-indigo-400 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-300">{stat.label}</div>
                </div>
              </ScaleIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScaleIn>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 sm:p-12 lg:p-16 text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-20 -right-20 w-80 h-80 bg-white rounded-full blur-3xl"
                />
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-400 rounded-full blur-3xl"
                />
              </div>

              <div className="relative">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4"
                >
                  Ready to build smarter dashboards?
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto"
                >
                  Join teams already using Zac-AI to turn AI into actionable insights. Start free, scale when you are ready.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-all duration-200 hover:shadow-xl"
                  >
                    Get started for free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-indigo-500/30 border border-indigo-400/30 text-white font-semibold hover:bg-indigo-500/40 transition-all duration-200"
                  >
                    Sign in to your account
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          </ScaleIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-[var(--color-bg-surface)] border-t border-slate-200 dark:border-[var(--color-border-subtle)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-slate-900 dark:text-white">Zac-AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
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
