import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Touch mode is a per-device display preference (larger tap targets for
// touchscreens / POS terminals), stored in this device's own
// localStorage. Until someone picks a mode explicitly, it follows the
// hardware: a touch-only device reports a "coarse" primary pointer.
function initialTouchMode() {
  const saved = localStorage.getItem('touchMode');
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [touchMode, setTouchModeState] = useState(initialTouchMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('touch', touchMode);
  }, [touchMode]);

  // Only an explicit choice is saved, so the auto-detected default keeps
  // following the hardware until someone taps the toggle.
  function setTouchMode(value) {
    localStorage.setItem('touchMode', value ? 'on' : 'off');
    setTouchModeState(value);
  }

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, touchMode, setTouchMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
