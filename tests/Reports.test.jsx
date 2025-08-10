import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../src/components/dashboard/ReportCharts', () => ({
  default: vi.fn(() => <div>ReportCharts</div>),
}));

import Reports from '../src/pages/Reports';
import ReportCharts from '../src/components/dashboard/ReportCharts';

vi.mock('../src/components/dashboard/useLiveDevices', () => ({
  useLiveDevices: () => ({
    deviceData: {
      S01: {
        growSensors: {
          L01G01: {
            deviceId: 'G01',
            location: 'L01',
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
  }),
}));

vi.mock('../src/components/dashboard/useHistory', () => ({
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

vi.mock('../src/components/SpectrumBarChart', () => ({ default: () => <div>SpectrumBarChart</div> }));
vi.mock('../src/components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../src/components/dashboard/TopicSection', () => ({ default: () => <div>TopicSection</div> }));
vi.mock('../src/components/dashboard/ReportControls', () => ({ default: () => <div>ReportControls</div> }));
vi.mock('../src/components/dashboard/NotesBlock', () => ({ default: () => <div>NotesBlock</div> }));

test('Reports page shows charts for AS7343 and SHT3x sensors (case-insensitive)', () => {
  render(<Reports />);
  expect(screen.queryByText('No reports available for this device.')).toBeNull();
  expect(ReportCharts).toHaveBeenCalled();
  const props = ReportCharts.mock.calls[0][0];
  expect(props.showSpectrum).toBe(true);
  expect(props.showClearLux).toBe(true);
  expect(props.showTempHum).toBe(true);
});

