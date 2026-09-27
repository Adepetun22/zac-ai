import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Menu, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import supabaseService from '../../services/supabaseService';
import AnimatedBackground from '../../components/landing/ConstellationGrid';
import ThemeToggle from '../../components/landing/ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Advantages', href: '/advantages' },
];

// Supabase reports a rejected link in the URL, and the params are not always in
// the query string: on the failure path GoTrue appends them to the fragment
// (e.g. `<origin>/reset-password#error=access_denied&error_code=otp_expired`).
// The router only reads the path, so the fragment survives and routing lands
// here on its own. Read both anyway, and fall back to the reason captured at
// app start in case the client has already cleaned the fragment up.
//
// Read once at render time rather than in an effect, so a blank form is never
// shown for a failed link.
const getResetErrorFromURL = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  // The fragment carries the callback result (or the rejection reason), never a
  // route, so the whole of it is safe to parse as params.
  const hash = window.location.hash || '';
  if (hash.includes('=')) {
    new URLSearchParams(hash.replace(/^#/, '')).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  const code = params.get('error_code');
  const description = params.get('error_description') || params.get('error');
  if (code || description) {
    return description
      ? `${description.replace(/\+/g, ' ')} (${code || 'unknown'})`
      : (code || 'This reset link is invalid or has expired.');
  }
  return supabaseService.readAuthError();
};

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(null);
  const [resetError] = useState(getResetErrorFromURL);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const navigate = useNavigate();
  const { resetPassword } = useAuthStore();

  // The reason the link was rejected was also stashed at app start, as a
  // fallback for when the client has already cleaned the fragment up. Drop it
  // now that it has been read into state, so a later visit is not greeted by a
  // stale "link expired" banner.
  useEffect(() => {
    supabaseService.clearAuthError();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Supabase's client parses the recovery token from the URL and establishes a
  // session before this page renders. Confirm that session actually exists —
  // landing here without one means the link was expired, already used, or
  // opened in the wrong browser, and updateUser would silently no-op.
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const { data } = await supabaseService.getCurrentUser();
        if (!cancelled) setHasRecoverySession(!!data?.user);
      } catch {
        if (!cancelled) setHasRecoverySession(false);
      }
    };
    checkSession();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { error } = await resetPassword(password);
      if (error) {
        setError(error.message || 'Failed to update password');
      } else {
        setSuccess('Your password has been updated. Redirecting you to sign in...');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating your password');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] text-slate-900 dark:text-[var(--color-text-primary)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm';

  return (
    <div className="relative min-h-screen flex flex-col text-slate-900 dark:text-[var(--color-text-primary)]" style={{ isolation: 'isolate' }}>
      <AnimatedBackground />

      {/* Nav */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700/60' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover transition-transform duration-300 group-hover:scale-110" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Zac-AI</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors">Home</Link>
              {NAV_LINKS.map(link => (
                <Link key={link.href} to={link.href} className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 transition-colors">{link.label}</Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Sign in</span>
              <Link to="/signup" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <ThemeToggle />
            </div>

            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
            <div className="px-4 py-4 space-y-3">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Home</Link>
              {NAV_LINKS.map(link => (
                <Link key={link.href} to={link.href} onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">{link.label}</Link>
              ))}
              <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)] hover:text-indigo-600 py-2">Sign up</Link>
              <div className="pt-2"><ThemeToggle /></div>
            </div>
          </div>
        )}
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Choose a new password</h1>
            <p className="text-slate-500 dark:text-[var(--color-text-secondary)]">Set a new password for your Zac-AI account</p>
          </div>

          <div className="bg-white/80 dark:bg-[var(--color-bg-surface)]/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 dark:border-[var(--color-border-subtle)] p-8">
            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800/30">{error}</div>
            )}
            {resetError && (
              <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm border border-amber-100 dark:border-amber-800/30">
                {resetError}
                <Link to="/forgot-password" className="block mt-2 font-medium underline">Request a new reset link</Link>
              </div>
            )}
            {success && (
              <div className="mb-5 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm border border-emerald-100 dark:border-emerald-800/30">{success}</div>
            )}

            {hasRecoverySession === false && !resetError && (
              <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm border border-amber-100 dark:border-amber-800/30">
                This password reset link is invalid or has expired. Reset links are single-use and time-limited.
                <Link to="/forgot-password" className="block mt-2 font-medium underline">Request a new reset link</Link>
              </div>
            )}

            {hasRecoverySession !== false && !success && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1.5">New Password</label>
                  <div className="relative">
                    <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' pr-12'} placeholder="Enter a new password" required minLength={6} autoFocus />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls + ' pr-12'} placeholder="Confirm your new password" required minLength={6} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  {loading ? (
                    <><svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Updating...</>
                  ) : 'Update Password'}
                </button>
              </form>
            )}

            <Link to="/login" className="mt-6 flex items-center justify-center text-sm text-slate-500 dark:text-[var(--color-text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-[var(--color-border-subtle)] py-8 bg-white/60 dark:bg-[var(--color-bg-surface)]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/zac-thumbnail.png.png" alt="Zac AI" className="w-9 h-9 rounded-lg object-cover" />
              <span className="text-lg font-bold text-slate-900 dark:text-white">Zac-AI</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
              <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-400 dark:text-[var(--color-text-muted)]">&copy; {new Date().getFullYear()} Zac-AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
