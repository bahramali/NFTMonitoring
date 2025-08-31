import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceCard from '../src/pages/Dashboard/components/DeviceCard.jsx';

test('renders device id and compact metrics', () => {
  const deviceData = {
    id: 'S01-L01-G03',
    tempC: 22.9,
    humidityPct: 56,
    co2ppm: 417,
    spectrum: { '405nm': 142, '425nm': 181, '450nm': 216 },
    otherLight: { lux: 5456.3, vis1: 450 },
    water: { tds_ppm: 998, ec_mScm: 1.6, tempC: 20.6, do_mgL: 5.5 }
  };

  render(<DeviceCard {...deviceData} />);

  // Device ID badge
  expect(screen.getByText('S01-L01-G03')).toBeInTheDocument();
  // Temperature & Humidity line
  expect(screen.getByText('[Temp, Humidity]')).toBeInTheDocument();
  expect(screen.getByText('[22.9 °C, 56 %]')).toBeInTheDocument();
  // CO₂
  expect(screen.getByText('CO₂')).toBeInTheDocument();
  expect(screen.getByText('417 ppm')).toBeInTheDocument();
  // Other light
  expect(screen.getByText('Other light')).toBeInTheDocument();
  expect(screen.getByText(/Lux: 5456.3/)).toBeInTheDocument();
  // Water line
  expect(screen.getByText('Water')).toBeInTheDocument();
  expect(screen.getByText(/TDS: 998 ppm/)).toBeInTheDocument();
});
