import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/components/DeviceTable';

const devices = {
  dev1: {
    temperature: 22.5,
    humidity: 55,
    lux: 1200,
    tds: 800,
    ec: 1.5,
    ph: 6.2,
    F1: 10,
    F2: 20,
    F3: 30,
    F4: 40,
    F5: 50,
    F6: 60,
    F7: 70,
    F8: 80,
    clear: 90,
    nir: 100,
    health: { sht3x: true, veml7700: true, tds: true, ph: true, as7341: true }
  }
};

test('renders sensor model column and merged cells', () => {
  const { container } = render(<DeviceTable devices={devices} />);
  expect(screen.getByText('Sensor model')).toBeInTheDocument();
  const shtCell = screen.getByText('SHT3x');
  expect(shtCell.closest('td')).toHaveAttribute('rowspan', '2');
  const asCell = screen.getByText('AS7341');
  expect(parseInt(asCell.closest('td').getAttribute('rowspan'))).toBeGreaterThan(2);
  expect(container).toBeInTheDocument();
});
