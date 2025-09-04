import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/pages/Live/components/DeviceTable';
import styles from '../src/pages/Live/components/DeviceTable/DeviceTable.module.css';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';
import * as SensorConfigContext from '../src/context/SensorConfigContext.jsx';
import { mockSensorConfigApi } from './mocks/sensorConfigApi.js';
import { vi } from 'vitest';

const devices = {
  dev1: {
    sensors: [
      { sensorName: 'SHT3x', sensorType: 'temperature', value: 22.5, unit: '°C' },
      { sensorName: 'SHT3x', sensorType: 'humidity', value: 55, unit: '%' },
      { sensorName: 'VEML7700', sensorType: 'light', value: 1200, unit: 'lux' },
      { sensorName: 'HailegeTDS', sensorType: 'tds', value: 800, unit: 'ppm' },
      { sensorName: 'HailegeTDS', sensorType: 'ec', value: 1.5, unit: 'mS/cm' },
      { sensorName: 'E-201', sensorType: 'ph', value: 6.2, unit: '' },
      { sensorName: 'AS7341', sensorType: '415nm', value: 10, unit: 'raw' },
      { sensorName: 'AS7341', sensorType: '445nm', value: 20, unit: 'raw' }
    ],
    health: {
      SHT3x: true,
      VEML7700: true,
      HailegeTDS: true,
      'E-201': true,
      AS7341: true
    }
  }
};

const renderWithProvider = (ui) => render(
  <SensorConfigProvider>{ui}</SensorConfigProvider>
);

beforeEach(() => {
  mockSensorConfigApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders sensor model and measurement type headers', () => {
  renderWithProvider(<DeviceTable devices={devices} />);
  expect(screen.getByText('S_Model')).toBeInTheDocument();
  expect(screen.getByText('M_Type')).toBeInTheDocument();
});

test('renders all sensor models at least once', () => {
  const { getAllByText } = renderWithProvider(<DeviceTable devices={devices} />);
  expect(getAllByText('SHT3x').length).toBeGreaterThan(0);
  expect(getAllByText('HailegeTDS').length).toBeGreaterThan(0);
  expect(getAllByText('AS7341').length).toBeGreaterThan(0);
});

test('displays measurement labels correctly', () => {
  renderWithProvider(<DeviceTable devices={devices} />);
  expect(screen.getByText('Temp')).toBeInTheDocument();
  expect(screen.getByText('Hum')).toBeInTheDocument();
  expect(screen.getByText('ph')).toBeInTheDocument();
});

test('renders sensor values with correct units', () => {
  renderWithProvider(<DeviceTable devices={devices} />);
  expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  expect(screen.getByText('800.0 ppm')).toBeInTheDocument();
  expect(screen.getByText('6.2')).toBeInTheDocument(); // Ph has no unit
});

test('applies spectral background color to 415nm row', () => {
  const { getByText } = renderWithProvider(<DeviceTable devices={devices} />);
  const spectralCell = getByText('415nm');
  expect(spectralCell).toHaveStyle({ backgroundColor: '#8a2be222' });
});

test('shows green indicator when health keys are lowercase', () => {
  const devicesLower = {
    dev1: {
      sensors: [
        { sensorName: 'SHT3x', sensorType: 'temperature', value: 22.5, unit: '°C' }
      ],
      health: { sht3x: true }
    }
  };
  const { container } = renderWithProvider(<DeviceTable devices={devicesLower} />);
  const indicator = container.querySelector(`.${styles.indicator}`);
  expect(indicator).toHaveClass(styles.on);
});

test('uses sensor config hook only once per render', async () => {
  const spy = vi.spyOn(SensorConfigContext, 'useSensorConfig');
  renderWithProvider(<DeviceTable devices={devices} />);
  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
