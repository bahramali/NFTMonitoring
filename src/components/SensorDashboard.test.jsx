import React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import SensorDashboard from './SensorDashboard';
import { FiltersProvider } from '../context/FiltersContext';

// Mock WebSocket hook so we can control messages
vi.mock('../hooks/useStomp', () => ({
  useStomp: (topics, onMessage) => {
    const list = Array.isArray(topics) ? topics : [topics];
    list.forEach((t) => {
      if (t === 'live_now') {
        global.__liveNowHandler = onMessage;
      }
    });
  },
}));

// Stub components that are not relevant for this test
vi.mock('./SpectrumBarChart', () => ({ default: () => <div /> }));
vi.mock('./Header', () => ({ default: () => <div /> }));
vi.mock('./dashboard/TopicSection', () => ({ default: () => <div /> }));
vi.mock('./dashboard/NotesBlock', () => ({ default: () => <div /> }));

test('overview items reflect live_now data', () => {
  render(
    <FiltersProvider>
      <SensorDashboard />
    </FiltersProvider>
  );

  act(() => {
    global.__liveNowHandler('live_now', {
      light: { average: 100, deviceCount: 1 },
      humidity: { average: 50, deviceCount: 2 },
      temperature: { average: 25, deviceCount: 3 },
      dissolvedOxygen: { average: 8, deviceCount: 4 },
      'Air Pump': { average: 1, deviceCount: 5 },
    });
  });

  const lightBox = screen.getByTitle('Light');
  expect(within(lightBox).getByText('100')).toBeInTheDocument();

  const tempBox = screen.getByTitle('Temperature');
  expect(within(tempBox).getByText('25')).toBeInTheDocument();

  const pumpBox = screen.getByTitle('Air Pump');
  expect(within(pumpBox).getByText('On')).toBeInTheDocument();
});

