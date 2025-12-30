import React from 'react';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
vi.mock('../src/pages/Reports', () => ({ default: () => <div>Reports Page</div> }));

vi.stubEnv('BASE_URL', '/NFTMonitoring/');

import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { renderWithProviders } from './utils/renderWithProviders';
import { mockSensorConfigApi } from './mocks/sensorConfigApi';

beforeEach(() => {
    mockSensorConfigApi();
    window.localStorage.setItem(
        'authSession',
        JSON.stringify({
            isAuthenticated: true,
            token: 'token',
            userId: 'admin-1',
            role: 'ADMIN',
            permissions: ['MONITORING_VIEW'],
            expiry: Date.now() + 60_000,
        }),
    );
});

test('reports link retains base path and is active when served from subdirectory', () => {
  window.history.pushState({}, '', '/NFTMonitoring/monitoring/reports');
  renderWithProviders(
      <AuthProvider>
          <App />
      </AuthProvider>,
  );
  const links = screen.getAllByRole('link', { name: /reports/i });
  expect(links.length).toBeGreaterThan(0);
  links.forEach((link) => {
      expect(link).toHaveAttribute('href', '/NFTMonitoring/monitoring/reports');
  });
  expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
});
