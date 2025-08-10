import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveNow } from '../src/hooks/useLiveNow';

vi.mock('../src/hooks/useStomp', () => ({
  useStomp: (_topics, onMessage) => {
    global.__liveNowHandler = onMessage;
  }
}));

test('provides default stats and updates from websocket', () => {
  const { result } = renderHook(() => useLiveNow());

  expect(result.current).toEqual({
    lux: { average: null, deviceCount: 0 },
    humidity: { average: null, deviceCount: 0 },
    temperature: { average: null, deviceCount: 0 },
    do: { average: null, deviceCount: 0 },
    airpump: { average: null, deviceCount: 0 }
  });

  act(() => {
    global.__liveNowHandler('live_now', {
      lux: { average: 100, deviceCount: 2 },
      humidity: { average: 50, deviceCount: 2 },
      temperature: { average: 20, deviceCount: 2 },
      do: { average: 6.5, deviceCount: 1 },
      airpump: { average: 1, deviceCount: 1 }
    });
  });

  expect(result.current.lux.average).toBe(100);
  expect(result.current.humidity.deviceCount).toBe(2);
});

