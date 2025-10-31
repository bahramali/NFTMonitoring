import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceCard from '../src/pages/Overview/components/DeviceCard.jsx';

test('renders device id and groups AS7343 readings inside the sensor list', () => {
  const deviceData = {
    id: 'S01-L01-G03',
    sensors: [
      { sensorName: 'SHT3x', sensorType: 'temperature', value: 22.9, unit: '°C' },
      { sensorName: 'SHT3x', sensorType: 'humidity', value: 56, unit: '%' },
      { sensorName: 'CO₂ Sensor', sensorType: 'co2', value: 417, unit: 'ppm' },
      { sensorName: 'AS7343', sensorType: '405nm', value: 274, unit: 'raw' },
      { sensorName: 'AS7343', sensorType: '425nm', value: 339, unit: 'raw' },
      { sensorName: 'AS7343', sensorType: '515nm', value: 493, unit: 'raw' },
      { sensorName: 'AS7343', sensorType: '555nm', value: 553, unit: 'raw' },
      { sensorName: 'AS7343', sensorType: '640nm', value: 580, unit: 'raw' },
      { sensorName: 'AS7343', sensorType: '690nm', value: 654, unit: 'raw' },
      { sensorName: 'VEML7700', sensorType: 'light', value: 3818.189, unit: 'lux' },
    ],
  };

  render(<DeviceCard {...deviceData} />);

  // Device ID badge
  expect(screen.getByText('S01-L01-G03')).toBeInTheDocument();

  // Top-level compact lines should be removed
  expect(screen.queryByText('[Temp, Humidity]')).not.toBeInTheDocument();

  // All sensor readings heading is present
  expect(screen.getByText('All sensor readings')).toBeInTheDocument();

  // Individual sensors are rendered as chips
  expect(screen.getAllByText('SHT3x')).toHaveLength(2);
  expect(screen.getByText('417 ppm')).toBeInTheDocument();

  // AS7343 wavelengths are grouped together
  expect(screen.getByText('AS7343 (Blue band)')).toBeInTheDocument();
  expect(screen.getByText(/405nm: 274 raw/)).toBeInTheDocument();
  expect(screen.getByText('AS7343 (Red/NIR band)')).toBeInTheDocument();
});
