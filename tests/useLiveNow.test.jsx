import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveNow } from '../src/hooks/useLiveNow';

// Mock useStomp to capture the message handler
vi.mock('../src/hooks/useStomp', () => ({
  useStomp: (_topics, onMessage) => {
    global.__liveNowHandler = onMessage;
  }
}));

test('captures live_now updates and normalizes keys', () => {
  const { result } = renderHook(() => useLiveNow());

  act(() => {
    global.__liveNowHandler('live_now', { Systems: {}, 'Last Update': 123 });
  });

  expect(result.current).toHaveProperty('systems');
  expect(result.current).toHaveProperty('lastupdate');
});
