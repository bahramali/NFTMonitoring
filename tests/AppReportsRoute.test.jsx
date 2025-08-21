import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../src/App';

vi.mock('../src/features/reports/ReportsUX', () => ({ default: () => <div>ReportsUX</div> }));
vi.mock('../src/components/Header', () => ({ default: () => <div>Header</div> }));

vi.mock('../src/features/dashboard/FiltersContext', () => ({
  FiltersProvider: ({ children }) => <div>{children}</div>,
  useFilters: () => ({
    layer: [],
    system: [],
    topic: [],
    setLayer: () => {},
    setSystem: () => {},
    setTopic: () => {},
    timing: [],
    location: [],
    sensorType: [],
    setTiming: () => {},
    setLocation: () => {},
    setSensorType: () => {},
    setLists: () => {},
    lists: { topics: [], layers: [], systems: [], timings: [], locations: [], sensorTypes: [] },
  }),
  ALL: 'ALL',
}));


test('reports link retains base path and is active when served from subdirectory', () => {
  vi.stubEnv('BASE_URL', '/NFTMonitoring/');
  window.history.pushState({}, '', '/NFTMonitoring/reports');
  render(<App />);
  const link = screen.getByRole('link', { name: /reports/i });
  expect(link).toHaveAttribute('href', '/NFTMonitoring/reports');
  // In React Router v6 for the active page, aria-current='page' is set
  expect(link).toHaveAttribute('aria-current', 'page');
});
