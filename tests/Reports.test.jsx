import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('../src/components/HistoryChart', () => ({
  default: () => <div data-testid="history-chart" />,
}));

vi.mock('../src/pages/Reports/context/ReportsFiltersContext.jsx', () => ({
  useReportsFilters: vi.fn(),
}));

import Reports from '../src/pages/Reports/index.jsx';
import { useReportsFilters } from '../src/pages/Reports/context/ReportsFiltersContext.jsx';

const originalFetch = global.fetch;

const makeFetchSuccess = () =>
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sensors: [] }),
    }),
  );

const noop = () => {};

const buildContext = (overrides = {}) => ({
  deviceMeta: { devices: [] },
  fromDate: '2024-01-01T00:00',
  toDate: '2024-01-01T06:00',
  setFromDate: vi.fn(),
  setToDate: vi.fn(),
  autoRefreshValue: 'Off',
  setAutoRefreshValue: vi.fn(),
  systems: [],
  layers: [],
  deviceIds: [],
  handleSystemChange: vi.fn(),
  handleLayerChange: vi.fn(),
  handleDeviceChange: vi.fn(),
  onReset: vi.fn(),
  onAddCompare: vi.fn(),
  onClearCompare: vi.fn(),
  onRemoveCompare: vi.fn(),
  compareItems: [],
  topics: [{ id: 'growSensors', label: 'Grow Sensors' }],
  selSensors: {
    growSensors: new Set(),
    germinationTopic: new Set(),
    waterTank: new Set(),
  },
  selectedTopics: new Set(['growSensors']),
  selectedTopicIds: ['growSensors'],
  selectedTopicSensors: { growSensors: [] },
  selectedSensorTypes: [],
  toggleTopicSelection: vi.fn(),
  setAllTopics: vi.fn(),
  clearTopics: vi.fn(),
  availableTopicSensors: { growSensors: [] },
  availableTopicDevices: { growSensors: [] },
  toggleSensor: vi.fn(),
  setAllSensors: vi.fn(),
  addSensors: vi.fn(),
  removeSensors: vi.fn(),
  clearSensors: vi.fn(),
  selectedCIDs: ['SYS-LAYER-DEVICE'],
  selectedCompositeIds: [],
  handleCompositeSelectionChange: vi.fn(),
  registerApplyHandler: vi.fn(),
  triggerApply: noop,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = makeFetchSuccess();
});

afterAll(() => {
  global.fetch = originalFetch;
});

test('renders reports charts with basic context data', async () => {
  const contextValue = buildContext();
  useReportsFilters.mockReturnValue(contextValue);

  render(<Reports />);

  expect(screen.getByRole('heading', { name: /filter your telemetry/i })).toBeInTheDocument();
  expect(contextValue.registerApplyHandler).toHaveBeenCalled();
  const registeredHandler = contextValue.registerApplyHandler.mock.calls[0][0];
  expect(typeof registeredHandler).toBe('function');

  expect(global.fetch).not.toHaveBeenCalled();

  await act(async () => {
    await registeredHandler();
  });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
});

test('includes selected sensor types in history query params', async () => {
  const contextValue = buildContext({
    selectedSensorTypes: ['A_Temp_C'],
    selectedTopicSensors: { growSensors: ['A_Temp_C'] },
  });
  useReportsFilters.mockReturnValue(contextValue);

  render(<Reports />);

  const registeredHandler = contextValue.registerApplyHandler.mock.calls[0][0];
  await act(async () => {
    await registeredHandler();
  });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  const requestUrl = global.fetch.mock.calls[0][0];
  const parsed = new URL(requestUrl, 'http://localhost');
  expect(parsed.searchParams.getAll('sensorType')).toContain('A_Temp_C');
});
