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
  fireEvent.click(await screen.findByRole('button', { name: /expand systems list/i }));

  expect(await screen.findByLabelText('D01')).toBeInTheDocument();
  const fetchCalls = global.fetch.mock.calls.map(([url]) => url.toString());
  const catalogCalls = fetchCalls.filter((url) => url.includes('/api/devices'));
  expect(catalogCalls).toHaveLength(1);
});

test('selecting devices triggers fetch for each compositeId', async () => {
  const devices = [
    { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: ['ph'] },
    { systemId: 'S01', layerId: 'L01', deviceId: 'G02', sensors: ['lux'] },
    { systemId: 'S02', layerId: 'L02', deviceId: 'G01', sensors: ['600nm'] },
  ];

  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockDeviceCatalog(devices) })
    .mockResolvedValue({ ok: true, json: async () => ({ sensors: [] }) });

  renderReportsView();
  fireEvent.click(await screen.findByRole('button', { name: /expand systems list/i }));

  const [deviceA, deviceC] = await screen.findAllByLabelText('G01');
  const deviceB = await screen.findByLabelText('G02');

  fireEvent.click(deviceA);
  fireEvent.click(deviceB);
  fireEvent.click(deviceC);

  await waitFor(() => {
    const historyCalls = global.fetch.mock.calls
      .map(([url]) => url.toString())
      .filter((url) => url.includes('/api/records/history'));
    expect(historyCalls.length).toBeGreaterThanOrEqual(3);
    expect(historyCalls.some((u) => u.includes('compositeId=S01-L01-G01'))).toBe(true);
    expect(historyCalls.some((u) => u.includes('compositeId=S01-L01-G02'))).toBe(true);
    expect(historyCalls.some((u) => u.includes('compositeId=S02-L02-G01'))).toBe(true);
  });
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
  fireEvent.click(await screen.findByRole('button', { name: /expand systems list/i }));

  const [device1] = await screen.findAllByLabelText('G01');
  const device2 = await screen.findByLabelText('G02');

  fireEvent.click(device1);
  fireEvent.click(device2);

  await waitFor(() => {
    const historyCalls = global.fetch.mock.calls
      .map(([url]) => url.toString())
      .filter((url) => url.includes('/api/records/history'));
    expect(historyCalls.length).toBeGreaterThanOrEqual(2);
  });

  global.fetch.mockClear();
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ sensors: [] }) });

  fireEvent.click(device1);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled();
  });

  const newCalls = global.fetch.mock.calls;
  const historyCalls = newCalls
    .map(([url]) => url.toString())
    .filter((url) => url.includes('/api/records/history'));

  expect(historyCalls.length).toBeGreaterThan(0);
  expect(
    historyCalls.some((url) =>
      url.includes('compositeId=S01-L01-G02') && !url.includes('S01-L01-G01')
    )
  ).toBe(true);
});

