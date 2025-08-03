import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/components/DeviceTable';

const devices = {
  tank1: {
    level: 75,
    pump: 'on',
    health: { level: true, pump: true }
  }
};

const devicesWithNames = {
  tank1: {
    sensors: [
      { sensorName: 'HailegeTDS', valueType: 'tds', value: 500, unit: 'ppm' },
      { sensorName: '', valueType: 'ec', value: 0.8, unit: 'mS/cm', source: 'HailegeTDS' },
      { sensorName: 'DS18B20', valueType: 'temperature', value: 24.3, unit: '°C' },
      { sensorName: 'DFROBOT', valueType: 'dissolvedOxygen', value: 3.1, unit: 'mg/L' }
    ],
    tds: { value: 500, unit: 'ppm' },
    ec: { value: 0.8, unit: 'mS/cm' },
    temperature: { value: 24.3, unit: '°C' },
    do: { value: 3.1, unit: 'mg/L' },
    health: { tds: true, sht3x: true, do: true }
  }
};

test('renders unknown sensor fields', () => {
  render(<DeviceTable devices={devices} />);
  expect(screen.getAllByText('level').length).toBeGreaterThan(0);
  expect(screen.getAllByText('pump').length).toBeGreaterThan(0);
  expect(screen.getByText('75.0')).toBeInTheDocument();
  expect(screen.getByText('on')).toBeInTheDocument();
});

test('renders sensor names from sensors array', () => {
  render(<DeviceTable devices={devicesWithNames} />);
  expect(screen.queryAllByText('HailegeTDS')).not.toHaveLength(0);
  expect(screen.queryAllByText('DS18B20')).not.toHaveLength(0);
  expect(screen.queryAllByText('DFROBOT')).not.toHaveLength(0);
  const doRow = screen.getByText('DO').closest('tr');
  expect(within(doRow).getByText('5')).toBeInTheDocument();
  expect(within(doRow).getByText('8')).toBeInTheDocument();
});
