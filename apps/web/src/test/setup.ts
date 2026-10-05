import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: (_listener: () => void) => {
      // Deprecated but required for compatibility
    },
    removeListener: (_listener: () => void) => {
      // Deprecated but required for compatibility
    },
    addEventListener: (_type: string, _listener: () => void) => {
      // Modern API stub
    },
    removeEventListener: (_type: string, _listener: () => void) => {
      // Modern API stub
    },
    dispatchEvent: () => false,
  }),
});
