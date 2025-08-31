import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceCard from '../src/components/DeviceCard.jsx';

test('renders composite id and sensor readings', () => {
  const sensors = [
    { sensorType: 'temperature', value: 22.5, unit: '°C' },
    { sensorType: 'humidity', value: 55, unit: '%' }
  ];

  render(<DeviceCard compositeId="S1-L1-D1" sensors={sensors} />);

  expect(screen.getByText('S1-L1-D1')).toBeInTheDocument();
  expect(screen.getByText('temperature')).toBeInTheDocument();
  expect(screen.getByText('22.5 °C')).toBeInTheDocument();
  expect(screen.getByText('humidity')).toBeInTheDocument();
  expect(screen.getByText('55 %')).toBeInTheDocument();
});
