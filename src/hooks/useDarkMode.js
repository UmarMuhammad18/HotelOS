import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    if (isDark) {
      document.body.style.background = '#090b0f';
      document.body.style.color = '#e8eaf0';
    } else {
      document.body.style.background = '#f5f5f5';
      document.body.style.color = '#1a1a1a';
    }
  }, [isDark]);

  return [isDark, setIsDark];
}