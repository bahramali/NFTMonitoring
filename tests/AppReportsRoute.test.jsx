import React from 'react';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
vi.mock('../src/pages/Reports', () => ({ default: () => <div>Reports Page</div> }));

vi.stubEnv('BASE_URL', '/NFTMonitoring/');

import App from '../src/App';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';

beforeEach(() => {
    mockSensorConfigApi();
});

test('reports link retains base path and is active when served from subdirectory', () => {
  window.history.pushState({}, '', '/NFTMonitoring/dashboard/reports');
  renderWithProviders(<App />);
  const link = screen.getByRole('link', { name: /reports/i });
  expect(link).toHaveAttribute('href', '/NFTMonitoring/dashboard/reports');
  // In React Router v6 for the active page, aria-current='page' is set
  expect(link).toHaveAttribute('aria-current', 'page');
});
