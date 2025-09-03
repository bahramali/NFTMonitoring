import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/pages/Live/components/DeviceTable';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';

const devices = {
  tank1: {
    sensors: [
      { sensorName: 'HailegeTDS', sensorType: 'tds', value: 500, unit: 'ppm' },
      { sensorName: '', sensorType: 'ec', value: 0.8, unit: 'mS/cm', source: 'HailegeTDS' },
      { sensorName: 'DS18B20', sensorType: 'temperature', value: 24.3, unit: '°C' },
      { sensorName: 'DFROBOT', sensorType: 'dissolvedOxygen', value: 3.1, unit: 'mg/L' }
    ],
    health: { HailegeTDS: true, DS18B20: true, DFROBOT: true }
  }
};

const renderWithProvider = (ui) => render(
  <SensorConfigProvider initialConfigs={{}}>{ui}</SensorConfigProvider>
);

test('renders sensor models from sensors array', () => {
  renderWithProvider(<DeviceTable devices={devices} />);
  expect(screen.getAllByText('HailegeTDS').length).toBeGreaterThan(0);
  expect(screen.getByText('DS18B20')).toBeInTheDocument();
  expect(screen.getByText('DFROBOT')).toBeInTheDocument();
});

test('renders sensor values correctly', () => {
  renderWithProvider(<DeviceTable devices={devices} />);
  expect(screen.getByText('500.0 ppm')).toBeInTheDocument();
  expect(screen.getByText('0.8 mS/cm')).toBeInTheDocument();
  expect(screen.getByText('24.3 °C')).toBeInTheDocument();
  expect(screen.getByText('3.1 mg/L')).toBeInTheDocument();
});
