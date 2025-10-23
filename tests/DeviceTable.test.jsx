import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('S_Model')).toBeInTheDocument();
  expect(screen.getByText('M_Type')).toBeInTheDocument();
});

test('renders all sensor models at least once', () => {
  const { getAllByText } = renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(getAllByText('SHT3x').length).toBeGreaterThan(0);
  expect(getAllByText('HailegeTDS').length).toBeGreaterThan(0);
  expect(getAllByText('AS7341').length).toBeGreaterThan(0);
});

test('displays measurement labels correctly', () => {
  renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('A_Temp')).toBeInTheDocument();
  expect(screen.getByText('A_RH')).toBeInTheDocument();
  expect(screen.getByText('ph')).toBeInTheDocument();
});

test('uses grow topic label when model is unknown', () => {
  const growDevices = {
    dev1: {
      sensors: [
        { sensorName: 'GenericGrowSensor', sensorType: 'humidity', value: 51.2, unit: '%' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={growDevices} topic="/topic/growSensors" />);
  expect(screen.getByText('A_RH')).toBeInTheDocument();
});

test('shows D_Temp label for DS18B20 temperature sensor', () => {
  const dsDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 24.3, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={dsDevices} topic="/topic/waterTank" />);
  expect(screen.getByText('D_Temp')).toBeInTheDocument();
});

test('uses water tank topic label when model is unknown', () => {
  const waterDevices = {
    dev1: {
      sensors: [
        { sensorName: 'UnknownProbe', sensorType: 'temperature', value: 23.7, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={waterDevices} topic="/topic/waterTank" />);
  expect(screen.getByText('D_Temp')).toBeInTheDocument();
});

test('shows G_Temp label for HDC302x temperature sensor', () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x', sensorType: 'temperature', value: 26.1, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('G_Temp')).toBeInTheDocument();
});

test('shows distinct label for DS18B20 temperature sensor on germination topic', () => {
  const dsDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 25.7, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={dsDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('D_Temp')).toBeInTheDocument();
});

test('uses germination topic label when model is unknown', () => {
  const genericDevices = {
    dev1: {
      sensors: [
        { sensorName: 'GenericSensor', sensorType: 'temperature', value: 25.2, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={genericDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('G_Temp')).toBeInTheDocument();
});

test('normalizes model names when mapping HDC302x temperature labels', () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x Temperature', sensorType: 'temperature', value: 25.4, unit: '°C' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('G_Temp')).toBeInTheDocument();
});

test('shows G_RH label for HDC302x humidity sensor', () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x', sensorType: 'humidity', value: 48.3, unit: '%' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('G_RH')).toBeInTheDocument();
});

test('normalizes model names when mapping HDC302x humidity labels', () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x-Humidity', sensorType: 'humidity', value: 49.1, unit: '%' }
      ],
      health: {}
    }
  };

  renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  expect(screen.getByText('G_RH')).toBeInTheDocument();
});

test('renders sensor values with correct units', () => {
  renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  expect(screen.getByText('800.0 ppm')).toBeInTheDocument();
  expect(screen.getByText('6.2')).toBeInTheDocument(); // Ph has no unit
});

test('displays configured min and max values', async () => {
  renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  const tempRow = screen.getByText('A_Temp').closest('tr');
  const spectralRow = screen.getByText('415nm').closest('tr');
  await waitFor(() => {
    expect(within(tempRow).getByText('20')).toBeInTheDocument();
    expect(within(tempRow).getByText('30')).toBeInTheDocument();
    expect(within(spectralRow).getByText('0')).toBeInTheDocument();
    expect(within(spectralRow).getByText('100')).toBeInTheDocument();
  });
});

test('applies spectral background color to 415nm row', () => {
  const { getByText } = renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
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
  const { container } = renderWithProvider(<DeviceTable devices={devicesLower} topic="/topic/growSensors" />);
  const indicator = container.querySelector(`.${styles.indicator}`);
  expect(indicator).toHaveClass(styles.on);
});

test('uses sensor config hook only once per render', async () => {
  const spy = vi.spyOn(SensorConfigContext, 'useSensorConfig');
  renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
