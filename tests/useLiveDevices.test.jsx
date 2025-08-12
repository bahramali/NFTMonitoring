import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveDevices } from '../src/components/dashboard/useLiveDevices';
import { SENSOR_TOPIC } from '../src/components/dashboard/dashboard.constants';

// Mock useStomp to capture the message handler
vi.mock('../src/hooks/useStomp', () => ({
  useStomp: (_topics, onMessage) => {
    global.__stompHandler = onMessage;
  }
}));

test('stores sensor data per composite device', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC], 'S01'));

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      sensors: [
        { type: 'temperature', value: '20' },
        { type: 'humidity', value: '50' }
      ]
    });
  });

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G02',
      system: 'S01',
      sensors: [
        { type: 'temperature', value: '21' },
        { type: 'humidity', value: '55' }
      ]
    });
  });

  expect(result.current.sensorData['L01G01'].temperature.value).toBe(20);
  expect(result.current.sensorData['G02'].humidity.value).toBe(55);
});
