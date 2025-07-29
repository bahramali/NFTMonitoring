import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceTable from '../src/components/DeviceTable';

const devices = {
  tank1: {
    level: 75,
    pump: 'on',
    health: { level: true, pump: true }
  }
};

test('renders unknown sensor fields', () => {
  render(<DeviceTable devices={devices} />);
  expect(screen.getByText('level')).toBeInTheDocument();
  expect(screen.getByText('pump')).toBeInTheDocument();
  expect(screen.getByText('75.0')).toBeInTheDocument();
  expect(screen.getByText('on')).toBeInTheDocument();
});
