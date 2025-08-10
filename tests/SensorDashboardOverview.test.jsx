import React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

import SensorDashboard from '../src/components/SensorDashboard';
import { FiltersProvider } from '../src/context/FiltersContext';

// Mock WebSocket hook so we can control messages
vi.mock('../src/hooks/useStomp', () => ({
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
vi.mock('../src/components/SpectrumBarChart', () => ({ default: () => <div /> }));
vi.mock('../src/components/Header', () => ({ default: () => <div /> }));
vi.mock('../src/components/dashboard/TopicSection', () => ({ default: () => <div /> }));
vi.mock('../src/components/dashboard/NotesBlock', () => ({ default: () => <div /> }));

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
      airpump: { average: 1, deviceCount: 5 },
    });
  });

  const lightBox = screen.getByTitle('Light');
  expect(within(lightBox).getByText('100')).toBeInTheDocument();

  const tempBox = screen.getByTitle('Temperature');
  expect(within(tempBox).getByText('25')).toBeInTheDocument();
});

