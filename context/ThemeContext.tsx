import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isDashboardOrAuthContext = (isLoggedIn: boolean) => {
  if (typeof window === 'undefined') return false;
  if (isLoggedIn) return true;
  const path = window.location.pathname;
  return (
    path.startsWith('/recruiter') ||
    path.startsWith('/admin') ||
    path.startsWith('/profile') ||
    path === '/dashboard' ||
    path === '/recruiter-jobs' ||
    path === '/admin-dashboard'
  );
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(auth.currentUser));

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      if (auth.currentUser || isDashboardOrAuthContext(Boolean(auth.currentUser))) {
        return 'light';
      }
      const stored = localStorage.getItem('theme') as Theme;
      if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    }
    return 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Listen to auth state: whenever a user is logged in, compulsory enforce light mode
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const loggedIn = Boolean(user);
      setIsLoggedIn(loggedIn);
      if (loggedIn || isDashboardOrAuthContext(loggedIn)) {
        setThemeState('light');
        localStorage.setItem('theme', 'light');
        window.document.documentElement.classList.remove('dark');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      // In dashboard / after login: COMPULSORY DAY (LIGHT) MODE ONLY
      if (isLoggedIn || isDashboardOrAuthContext(isLoggedIn)) {
        root.classList.remove('dark');
        setResolvedTheme('light');
        localStorage.setItem('theme', 'light');
        return;
      }

      let targetTheme = theme;
      if (theme === 'system') {
        targetTheme = mediaQuery.matches ? 'dark' : 'light';
      }

      setResolvedTheme(targetTheme as 'light' | 'dark');

      if (targetTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    if (!isLoggedIn && !isDashboardOrAuthContext(isLoggedIn)) {
      localStorage.setItem('theme', theme);
    }

    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, isLoggedIn]);

  const setTheme = (newTheme: Theme) => {
    // If in dashboard / logged in, ignore any dark requests, compulsory enforce day mode
    if (isLoggedIn || isDashboardOrAuthContext(isLoggedIn)) {
      setThemeState('light');
      window.document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      return;
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    // If in dashboard / logged in, ignore toggle, compulsory enforce day mode
    if (isLoggedIn || isDashboardOrAuthContext(isLoggedIn)) {
      setThemeState('light');
      window.document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      return;
    }
    setThemeState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const activeTheme = (isLoggedIn || isDashboardOrAuthContext(isLoggedIn)) ? 'light' : theme;
  const isDarkActive = (isLoggedIn || isDashboardOrAuthContext(isLoggedIn)) ? false : resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, setTheme, toggleTheme, isDark: isDarkActive }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};