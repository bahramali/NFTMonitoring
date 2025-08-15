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
        { sensorType: 'temperature', value: '20' },
        { sensorType: 'humidity', value: '50' }
      ]
    });
  });

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G02',
      system: 'S01',
      sensors: [
        { sensorType: 'temperature', value: '21' },
        { sensorType: 'humidity', value: '55' }
      ]
    });
  });

  expect(result.current.sensorData['L01G01'].temperature.value).toBe(20);
  expect(result.current.sensorData['G02'].humidity.value).toBe(55);
});

test('merges controllers from multiple topics', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC, 'waterOutput'], 'S01'));

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }]
    });
  });

  act(() => {
    global.__stompHandler('waterOutput', {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'Pump1', type: 'pump', state: 'off' }]
    });
  });

  act(() => {
    global.__stompHandler('waterOutput', {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'Pump1', type: 'pump', state: 'on' }]
    });
  });

  const ctrls = result.current.mergedDevices['L01G01'].controllers;
  expect(ctrls).toHaveLength(2);
  const valve = ctrls.find(c => c.name === 'Valve1');
  const pump = ctrls.find(c => c.name === 'Pump1');
  expect(valve.state).toBe('open');
  expect(pump.state).toBe('on');
});
