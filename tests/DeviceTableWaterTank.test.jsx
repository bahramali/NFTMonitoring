import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/components/DeviceTable';

const devices = {
  tank1: {
    sensors: [
      { sensorName: 'HailegeTDS', valueType: 'tds', value: 500, unit: 'ppm' },
      { sensorName: '', valueType: 'ec', value: 0.8, unit: 'mS/cm', source: 'HailegeTDS' },
      { sensorName: 'DS18B20', valueType: 'temperature', value: 24.3, unit: '°C' },
      { sensorName: 'DFROBOT', valueType: 'dissolvedOxygen', value: 3.1, unit: 'mg/L' }
    ],
    health: { HailegeTDS: true, DS18B20: true, DFROBOT: true }
  }
};

test('renders sensor models from sensors array', () => {
  render(<DeviceTable devices={devices} />);
  expect(screen.getAllByText('HailegeTDS').length).toBeGreaterThan(0);
  expect(screen.getByText('DS18B20')).toBeInTheDocument();
  expect(screen.getByText('DFROBOT')).toBeInTheDocument();
});

test('renders sensor values correctly', () => {
  render(<DeviceTable devices={devices} />);
  expect(screen.getByText('500.0 ppm')).toBeInTheDocument();
  expect(screen.getByText('0.8 mS/cm')).toBeInTheDocument();
  expect(screen.getByText('24.3 °C')).toBeInTheDocument();
  expect(screen.getByText('3.1 mg/L')).toBeInTheDocument();
});
