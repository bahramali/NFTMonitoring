// Reports.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// mock ReportCharts to observe render
vi.mock('../src/pages/Reports/components/ReportCharts', () => ({
  default: vi.fn(() => <div data-testid="charts">ReportCharts</div>),
}));

import Reports from '../src/pages/Reports';
import ReportCharts from '../src/pages/Reports/components/ReportCharts';
import Sidebar from '../src/pages/common/Sidebar';
import { ReportsFiltersProvider } from '../src/context/ReportsFiltersContext.jsx';

const mockDeviceCatalog = (devices) => ({ devices });

const renderReportsView = () => render(
  <MemoryRouter initialEntries={['/reports']}>
    <ReportsFiltersProvider>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <Reports />
      </div>
    </ReportsFiltersProvider>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

test('renders Reports and shows charts', async () => {
  const catalog = mockDeviceCatalog([
    { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: ['ph'] },
  ]);

  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => catalog })
    .mockResolvedValue({ ok: true, json: async () => ({ sensors: [] }) });

  renderReportsView();

  expect(await screen.findByTestId('charts')).toBeInTheDocument();
  expect(ReportCharts).toHaveBeenCalled();
});

test('fetches device catalog from API', async () => {
  const payload = {
    devices: [
      { systemId: 'S10', layerId: 'L20', deviceId: 'D01', sensors: ['ph'] },
    ],
    systems: [{ id: 'S10', deviceCompositeIds: ['S10-L20-D01'] }],
  };

  global.fetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ sensors: [] }),
    });

  renderReportsView();

  expect(await screen.findByLabelText('S10-L20-D01')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0].toString()).toContain('/api/devices');
});

test('Apply sends one request per compositeId', async () => {
  const devices = [
    { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: ['ph'] },
    { systemId: 'S01', layerId: 'L01', deviceId: 'G02', sensors: ['lux'] },
    { systemId: 'S02', layerId: 'L02', deviceId: 'G01', sensors: ['600nm'] },
  ];

  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockDeviceCatalog(devices) })
    .mockResolvedValue({ ok: true, json: async () => ({ sensors: [] }) });

  renderReportsView();

  await screen.findByLabelText('S01-L01-G01');
  await screen.findByLabelText('S01-L01-G02');
  await screen.findByLabelText('S02-L02-G01');

  fireEvent.click(await screen.findByRole('button', { name: /apply/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(1 + devices.length);
  });
  const called = global.fetch.mock.calls.slice(1).map((c) => c[0].toString());
  expect(called.some((u) => u.includes('compositeId=S01-L01-G01'))).toBe(true);
  expect(called.some((u) => u.includes('compositeId=S01-L01-G02'))).toBe(true);
  expect(called.some((u) => u.includes('compositeId=S02-L02-G01'))).toBe(true);
});

test('filters by Composite ID selection only fetches selected CIDs', async () => {
  const devices = [
    { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: [] },
    { systemId: 'S01', layerId: 'L01', deviceId: 'G02', sensors: [] },
  ];

  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockDeviceCatalog(devices) })
    .mockResolvedValue({ ok: true, json: async () => ({ sensors: [] }) });

  renderReportsView();

  const cid1 = await screen.findByLabelText('S01-L01-G01');
  const cid2 = await screen.findByLabelText('S01-L01-G02');

  if (cid1.checked) fireEvent.click(cid1);
  if (!cid2.checked) fireEvent.click(cid2);

  await waitFor(() => {
    expect(cid1.checked).toBe(false);
    expect(cid2.checked).toBe(true);
  });

  fireEvent.click(screen.getByRole('button', { name: /apply/i }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

  const url = global.fetch.mock.calls[1][0].toString();
  expect(url.includes('compositeId=S01-L01-G02')).toBe(true);
  expect(url.includes('compositeId=S01-L01-G01')).toBe(false);
});

