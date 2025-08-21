import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../src/App';

vi.mock('../src/components/dashboard/ReportControls', () => ({ default: () => <div>ReportControls</div> }));
vi.mock('../src/components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../src/components/dashboard/ReportCharts', () => ({ default: () => <div>ReportCharts</div> }));
vi.mock('../src/components/dashboard/useLiveDevices', () => ({
  useLiveDevices: () => ({ deviceData: {}, availableCompositeIds: [] }),
}));
vi.mock('../src/components/dashboard/useHistory', () => ({
  useHistory: () => ({}),
}));
vi.stubEnv('BASE_URL', '/NFTMonitoring/');

vi.mock('../src/context/FiltersContext', () => ({
  FiltersProvider: ({ children }) => <div>{children}</div>,
  useFilters: () => ({
    layer: [],
    system: [],
    topic: [],
    setLayer: () => {},
    setSystem: () => {},
    setTopic: () => {},
    setLists: () => {},
    lists: { topics: [], layers: [], systems: [] },
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
