import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Standard window scroll reset
    window.scrollTo(0, 0);

    // Layout scroll container reset (the one with overflow-y-auto in Layout.tsx)
    const scrollContainer = document.querySelector('main > div.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
