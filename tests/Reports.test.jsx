import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

const liveDevicesMock = vi.fn();

vi.mock('../src/pages/Reports/components/ReportCharts', () => ({
  default: vi.fn(() => <div>ReportCharts</div>),
}));

vi.mock('../src/components/useLiveDevices', () => ({
  useLiveDevices: (...args) => liveDevicesMock(...args),
}));

vi.mock('../src/components/useHistory', () => ({
  useHistory: () => ({
    rangeData: [],
    tempRangeData: [],
    phRangeData: [],
    ecTdsRangeData: [],
    doRangeData: [],
    xDomain: [],
    startTime: 0,
    endTime: 0,
    fetchReportData: vi.fn(),
  }),
}));

vi.mock('../src/context/FiltersContext', () => ({
  useFilters: () => ({
    device: 'ALL',
    layer: 'ALL',
    system: 'ALL',
    topic: 'ALL',
    setLists: vi.fn(),
  }),
  ALL: 'ALL',
}));

vi.mock('../src/components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../src/pages/Reports/components/ReportControls', () => ({ default: () => <div>ReportControls</div> }));

import Reports from '../src/pages/Reports';
import ReportCharts from '../src/pages/Reports/components/ReportCharts';

beforeEach(() => {
  liveDevicesMock.mockReset();
  ReportCharts.mockClear();
});

test('Reports page shows charts for AS7343 and SHT3x sensors (case-insensitive)', () => {
  liveDevicesMock.mockReturnValue({
    deviceData: {
      S01: {
        growSensors: {
          L01G01: {
            deviceId: 'G01',
            layer: 'L01',
            sensors: [
              { sensorName: 'AS7343' },
              { sensorName: 'SHT3x' },
            ],
          },
        },
      },
    },
    sensorData: {},
    availableCompositeIds: ['L01G01'],
    mergedDevices: {},
  });

  render(<Reports />);
  expect(screen.queryByText('No reports available for this composite ID.')).toBeNull();
  expect(ReportCharts).toHaveBeenCalled();
  const props = ReportCharts.mock.calls[0][0];
  expect(props.showSpectrum).toBe(true);
  expect(props.showClearLux).toBe(true);
  expect(props.showTempHum).toBe(true);
});

test('Reports page defaults to first available system when initial system has no devices', async () => {
  liveDevicesMock.mockReturnValue({
    deviceData: {
      S02: {
        growSensors: {
          L01G01: {
            deviceId: 'G01',
            layer: 'L01',
            sensors: [{ sensorName: 'AS7343' }],
          },
        },
      },
    },
    sensorData: {},
    availableCompositeIds: ['L01G01'],
    mergedDevices: {},
  });

  render(<Reports />);
  await waitFor(() => expect(ReportCharts).toHaveBeenCalled());
  expect(screen.queryByText('No reports available for this composite ID.')).toBeNull();
});

test('Devices box displays device name instead of composite ID', () => {
  liveDevicesMock.mockReturnValue({
    deviceData: {
      S01: {
        growSensors: {
          L01G01: {
            deviceId: 'G01',
            layer: 'L01',
            sensors: [{ sensorName: 'SHT3x' }],
          },
        },
      },
    },
    sensorData: {},
    availableCompositeIds: ['L01G01'],
    mergedDevices: {},
  });

  render(<Reports />);
  expect(screen.getByText('G01')).toBeInTheDocument();
  expect(screen.queryByText('L01G01')).toBeNull();
});

