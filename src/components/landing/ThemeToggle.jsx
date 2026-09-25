import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../../store/themeStore';

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolveTheme(s.theme));
  const setTheme = useThemeStore((s) => s.setTheme);

  const toggle = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 ${
        isDark
          ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-indigo-400 hover:border-indigo-500/50'
          : 'bg-white/80 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'
      }`}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
