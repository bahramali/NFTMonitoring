import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeviceCard from '../src/components/DeviceCard';

const data = {
  controllers: [
    { name: 'Valve1', type: 'valve', state: 'open' },
    { name: 'Pump1', type: 'pump', state: 'off' }
  ]
};

it('renders controller information', () => {
  render(<DeviceCard compositeId="D1" data={data} />);
  expect(screen.getByText('Controllers')).toBeInTheDocument();
  expect(screen.getByText('Valve1')).toBeInTheDocument();
  expect(screen.getByText('Pump1')).toBeInTheDocument();
  expect(screen.getByText('valve')).toBeInTheDocument();
  expect(screen.getByText('off')).toBeInTheDocument();
});
