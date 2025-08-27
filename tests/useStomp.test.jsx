import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

let clientInstance;

vi.mock('@stomp/stompjs', () => {
  class Client {
    constructor() {
      clientInstance = this;
      this.subscribed = [];
      this.onConnect = null;
    }
    activate() {
      // Immediately invoke onConnect to simulate successful connection
      this.onConnect?.();
    }
    deactivate() {}
    subscribe(dest, cb) {
      this.subscribed.push(dest);
      void cb;
      return { unsubscribe: () => {} };
    }
  }
  return { Client };
});

import { useStomp } from '../src/hooks/useStomp.js';

test('supports topics with or without /topic prefix', async () => {
  renderHook(() => useStomp(['/topic/alpha', 'beta'], () => {}));

  // Wait for effect to run
  await act(async () => {});

  expect(clientInstance.subscribed).toContain('/topic/alpha');
  expect(clientInstance.subscribed).toContain('/topic/beta');
});

