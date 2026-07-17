import { create } from 'zustand';

// Helper function to adjust color shade
const shadeColor = (color, percent) => {
  // Convert hex to RGB
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  // Adjust each component
  R = Math.min(255, Math.max(0, R + R * percent / 100));
  G = Math.min(255, Math.max(0, G + G * percent / 100));
  B = Math.min(255, Math.max(0, B + B * percent / 100));

  // Convert back to hex
  const RR = Math.round(R).toString(16).padStart(2, '0');
  const GG = Math.round(G).toString(16).padStart(2, '0');
  const BB = Math.round(B).toString(16).padStart(2, '0');

  return '#' + RR + GG + BB;
};

const STORAGE_KEYS = { theme: 'theme', accent: 'accentColor' };

const useThemeStore = create((set, get) => ({
    // Theme state ('light', 'dark', or 'system')
    theme: 'system',

    // Accent color state
    accentColor: '#6366f1',

    // Resolve 'system' to an explicit 'light' | 'dark'
    resolveTheme: (theme) => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme;
    },

    // Apply the resolved theme + accent color to the document
    applyTheme: () => {
      const { theme, accentColor } = get();
      const resolved = get().resolveTheme(theme);
      const root = document.documentElement;

      root.setAttribute('data-theme', resolved);
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);

      // Accent brand tokens (live on :root so they override both themes)
      root.style.setProperty('--color-brand-500', accentColor);
      root.style.setProperty('--color-brand-50', shadeColor(accentColor, 88));
      root.style.setProperty('--color-brand-700', shadeColor(accentColor, -32));
    },

    // Set theme
    setTheme: (theme) => {
      set({ theme });
      get().applyTheme();
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    },

    // Set accent color
    setAccentColor: (color) => {
      set({ accentColor: color });
      get().applyTheme();
      localStorage.setItem(STORAGE_KEYS.accent, color);
    },

    // Initialize theme based on saved preference (falling back to system)
    initTheme: () => {
      const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
      const storedAccent = localStorage.getItem(STORAGE_KEYS.accent);

      if (storedAccent) set({ accentColor: storedAccent });
      get().setTheme(storedTheme || 'system');
    },

    // Update theme when the OS preference changes (only in 'system' mode)
    handleSystemThemeChange: () => {
      if (get().theme === 'system') {
        get().applyTheme();
      }
    }
  })
);

export default useThemeStore;
