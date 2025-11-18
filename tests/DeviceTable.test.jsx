import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import '@testing-library/jest-dom';
import { DeviceTable } from '../src/pages/Live/LiveDashboard.jsx';
import styles from '../src/pages/Live/LiveDashboard.module.css';
import { SensorConfigProvider } from '../src/context/SensorConfigContext.jsx';
import * as SensorConfigContext from '../src/context/SensorConfigContext.jsx';
import { mockSensorConfigApi } from './mocks/sensorConfigApi.js';
import { vi } from 'vitest';

const devices = {
  dev1: {
    sensors: [
      { sensorName: 'SHT3x', sensorType: 'A_Temp_C', value: 22.5, unit: '°C' },
      { sensorName: 'SHT3x', sensorType: 'A_RH_C', value: 55, unit: '%' },
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

const renderWithProvider = async (ui) => {
  let renderResult;
  await act(async () => {
    renderResult = render(
      <SensorConfigProvider>{ui}</SensorConfigProvider>
    );
  });
  return renderResult;
};

beforeEach(() => {
  mockSensorConfigApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders sensor model and measurement type headers', async () => {
  await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('S_Model')).toBeInTheDocument();
  expect(screen.getByText('M_Type')).toBeInTheDocument();
});

test('renders all sensor models at least once', async () => {
  const { getAllByText } = await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(getAllByText('SHT3x').length).toBeGreaterThan(0);
  expect(getAllByText('HailegeTDS').length).toBeGreaterThan(0);
  expect(getAllByText('AS7341').length).toBeGreaterThan(0);
});

test('displays measurement labels correctly', async () => {
  await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('A_Temp_C')).toBeInTheDocument();
  expect(screen.getByText('A_RH_C')).toBeInTheDocument();
  expect(screen.getByText('ph')).toBeInTheDocument();
});

test('shows raw humidity label when model is unknown', async () => {
  const growDevices = {
    dev1: {
      sensors: [
        { sensorName: 'GenericGrowSensor', sensorType: 'A_RH_C', value: 51.2, unit: '%' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={growDevices} topic="/topic/growSensors" />);
  const row = screen.getByText('GenericGrowSensor').closest('tr');
  expect(within(row).getByText('A_RH_C')).toBeInTheDocument();
});

test('shows raw temperature label for DS18B20 on water topic', async () => {
  const dsDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 24.3, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={dsDevices} topic="/topic/waterTank" />);
  const row = screen.getByText('DS18B20').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('shows raw temperature label when model is unknown on water topic', async () => {
  const waterDevices = {
    dev1: {
      sensors: [
        { sensorName: 'UnknownProbe', sensorType: 'temperature', value: 23.7, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={waterDevices} topic="/topic/waterTank" />);
  const row = screen.getByText('UnknownProbe').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('shows raw temperature label for HDC302x on germination topic', async () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x', sensorType: 'temperature', value: 26.1, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('HDC302x').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('shows raw temperature label for DS18B20 on germination topic', async () => {
  const dsDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 25.7, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={dsDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('DS18B20').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('shows raw temperature label when model is unknown on germination topic', async () => {
  const genericDevices = {
    dev1: {
      sensors: [
        { sensorName: 'GenericSensor', sensorType: 'temperature', value: 25.2, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={genericDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('GenericSensor').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('normalizes model names while keeping raw temperature label', async () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x Temperature', sensorType: 'temperature', value: 25.4, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('HDC302x Temperature').closest('tr');
  expect(within(row).getByText('temperature')).toBeInTheDocument();
});

test('shows raw humidity label for HDC302x sensor', async () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x', sensorType: 'humidity', value: 48.3, unit: '%' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('HDC302x').closest('tr');
  expect(within(row).getByText('humidity')).toBeInTheDocument();
});

test('normalizes model names while keeping raw humidity label', async () => {
  const hdcDevices = {
    dev1: {
      sensors: [
        { sensorName: 'HDC302x-Humidity', sensorType: 'humidity', value: 49.1, unit: '%' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={hdcDevices} topic="/topic/germinationTopic" />);
  const row = screen.getByText('HDC302x-Humidity').closest('tr');
  expect(within(row).getByText('humidity')).toBeInTheDocument();
});

test('renders sensor values with correct units', async () => {
  await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  expect(screen.getByText('800.0 ppm')).toBeInTheDocument();
  expect(screen.getByText('6.2')).toBeInTheDocument(); // Ph has no unit
});

test('displays configured min and max values', async () => {
  await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  const tempRow = screen.getByText('A_Temp_C').closest('tr');
  const spectralRow = screen.getByText('415nm').closest('tr');
  await waitFor(() => {
    expect(within(tempRow).getByText('20')).toBeInTheDocument();
    expect(within(tempRow).getByText('30')).toBeInTheDocument();
    expect(within(spectralRow).getByText('0')).toBeInTheDocument();
    expect(within(spectralRow).getByText('100')).toBeInTheDocument();
  });
});

test('uses topic-specific ranges when available', async () => {
  const waterDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 24.3, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={waterDevices} topic="/topic/waterTank" />);
  const tempRow = screen.getByText('temperature').closest('tr');
  await waitFor(() => {
    expect(within(tempRow).getByText('18')).toBeInTheDocument();
    expect(within(tempRow).getByText('26')).toBeInTheDocument();
  });
});

test('matches ranges by configured metric label when sensor type differs', async () => {
  const germDevices = {
    dev1: {
      sensors: [
        { sensorName: 'DS18B20', sensorType: 'temperature', value: 25.2, unit: '°C' }
      ],
      health: {}
    }
  };

  await renderWithProvider(<DeviceTable devices={germDevices} topic="/topic/germinationTopic" />);
  const tempRow = screen.getByText('temperature').closest('tr');
  await waitFor(() => {
    expect(within(tempRow).getByText('15')).toBeInTheDocument();
    expect(within(tempRow).getByText('25')).toBeInTheDocument();
  });
});

test('applies spectral background color to 415nm row', async () => {
  const { getByText } = await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  const spectralCell = getByText('415nm');
  expect(spectralCell).toHaveStyle({ backgroundColor: '#8a2be222' });
});

test('shows green indicator when health keys are lowercase', async () => {
  const devicesLower = {
    dev1: {
      sensors: [
        { sensorName: 'SHT3x', sensorType: 'A_Temp_C', value: 22.5, unit: '°C' }
      ],
      health: { sht3x: true }
    }
  };
  const { container } = await renderWithProvider(<DeviceTable devices={devicesLower} topic="/topic/growSensors" />);
  const indicator = container.querySelector(`.${styles.indicator}`);
  expect(indicator).toHaveClass(styles.indicatorOn);
});

test('uses sensor config hook only once per render', async () => {
  const spy = vi.spyOn(SensorConfigContext, 'useSensorConfig');
  await renderWithProvider(<DeviceTable devices={devices} topic="/topic/growSensors" />);
  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
