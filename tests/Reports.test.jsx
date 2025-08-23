// Reports.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// mock ReportCharts to observe render
vi.mock('../src/pages/Reports/components/ReportCharts', () => ({
  default: vi.fn(() => <div data-testid="charts">ReportCharts</div>),
}));

// import after mocks
import Reports from '../src/pages/Reports';
import ReportCharts from '../src/pages/Reports/components/ReportCharts';

const setMeta = (meta) =>
    localStorage.setItem('reportsMeta:v1', JSON.stringify(meta));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  // mock fetch
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ series: [] }),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

test('renders Reports and shows charts', async () => {
  setMeta({
    version: 'x',
    devices: [
      { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: ['ph'] },
    ],
  });

  render(<Reports />);

  // charts component should render
  expect(await screen.findByTestId('charts')).toBeInTheDocument();
  expect(ReportCharts).toHaveBeenCalled();
});

test('Apply sends one request per compositeId (separate fetch per CID)', async () => {
  setMeta({
    version: 'x',
    devices: [
      { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: ['ph'] },
      { systemId: 'S01', layerId: 'L01', deviceId: 'G02', sensors: ['lux'] },
      { systemId: 'S02', layerId: 'L02', deviceId: 'G01', sensors: ['600nm'] },
    ],
  });

  render(<Reports />);

  // click Apply
  const applyBtn = await screen.findByRole('button', { name: /apply/i });
  fireEvent.click(applyBtn);

  // expect one fetch per CID
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  const calledUrls = global.fetch.mock.calls.map((c) => c[0].toString());
  expect(calledUrls.some((u) => u.includes('compositeId=S01-L01-G01'))).toBe(true);
  expect(calledUrls.some((u) => u.includes('compositeId=S01-L01-G02'))).toBe(true);
  expect(calledUrls.some((u) => u.includes('compositeId=S02-L02-G01'))).toBe(true);
});
/*

test('filters by Composite ID selection only fetches selected CIDs', async () => {
  setMeta({
    version: 'x',
    devices: [
      { systemId: 'S01', layerId: 'L01', deviceId: 'G01', sensors: [] },
      { systemId: 'S01', layerId: 'L01', deviceId: 'G02', sensors: [] },
    ],
  });

  render(<Reports />);


  const cid2 = await screen.findByLabelText('S01-L01-G02');
  fireEvent.click(cid2);
  const cid1 = await screen.findByLabelText('S01-L01-G01');
  if (cid1 instanceof HTMLInputElement && cid1.checked) {
    fireEvent.click(cid1);
  }

  // Apply
  fireEvent.click(screen.getByRole('button', { name: /apply/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  const url = global.fetch.mock.calls[0][0].toString();
  expect(url.includes('compositeId=S01-L01-G02')).toBe(true);
  expect(url.includes('compositeId=S01-L01-G01')).toBe(false);
});
*/
