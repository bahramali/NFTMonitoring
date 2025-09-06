import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveDevices } from '../src/pages/common/useLiveDevices.js';
import { SENSOR_TOPIC } from '../src/pages/common/dashboard.constants.js';
import growPayload from './data/growSensors.json';
import tankPayload from './data/waterTank.json';
import oxyPayload from './data/oxygenPump.json';

// Mock useStomp to capture the message handler
vi.mock('../src/hooks/useStomp', () => ({
  useStomp: (_topics, onMessage) => {
    global.__stompHandler = onMessage;
  }
}));

test('stores sensor data and actuator controllers per composite device', () => {
  const { result } = renderHook(() =>
    useLiveDevices([SENSOR_TOPIC, 'actuator/oxygenPump'])
  );

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, growPayload);
  });

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, tankPayload);
  });

  act(() => {
    global.__stompHandler('actuator/oxygenPump', oxyPayload);
  });

  expect(
    result.current.sensorData[growPayload.compositeId].temperature.value
  ).toBeCloseTo(27.75);
  expect(result.current.sensorData[tankPayload.compositeId]).toBeUndefined();
  expect(
    result.current.mergedDevices[oxyPayload.compositeId].controllers[0]
  ).toEqual(oxyPayload.controllers[0]);
});

test('aggregates devices across multiple systems', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC]));

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      sensors: [{ sensorType: 'temperature', value: 20 }]
    });
  });

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G02',
      layer: 'L02',
      system: 'S02',
      sensors: [
        { sensorType: 'temperature', value: 25 },
        { sensorType: 'humidity', value: 50 }
      ]
    });
  });

  expect(result.current.availableCompositeIds).toEqual(
    expect.arrayContaining(['L01G01', 'L02G02'])
  );
  expect(result.current.sensorData['L02G02'].temperature.value).toBe(25);
});

test('merges controllers from multiple topics', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC, 'waterOutput']));

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

test('handles actuator payloads with JSON payload and merges controllers', () => {
  const { result } = renderHook(() =>
    useLiveDevices([SENSOR_TOPIC, 'actuator/oxygenPump'])
  );

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }],
    });
  });

  act(() => {
    const payload = {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'OxyPump', type: 'pump', state: 'off' }],
    };
    global.__stompHandler('actuator/oxygenPump', {
      payload: JSON.stringify(payload),
    });
  });

  act(() => {
    const payload = {
      deviceId: 'G01',
      layer: 'L01',
      system: 'S01',
      controllers: [{ name: 'OxyPump', type: 'pump', state: 'on' }],
    };
    global.__stompHandler('actuator/oxygenPump', { payload });
  });

  const ctrls = result.current.mergedDevices['L01G01'].controllers;
  expect(ctrls).toHaveLength(2);
  const valve = ctrls.find((c) => c.name === 'Valve1');
  const pump = ctrls.find((c) => c.name === 'OxyPump');
  expect(valve.state).toBe('open');
  expect(pump.state).toBe('on');
});

test('uses provided compositeId when present', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC]));

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      compositeId: 'C123',
      deviceId: 'ignored',
      layer: 'L99',
      system: 'S01',
      sensors: [
        { sensorType: 'temperature', value: '22' },
        { sensorType: 'humidity', value: '55' }
      ]
    });
  });

  expect(result.current.sensorData['C123'].temperature.value).toBe(22);
  expect(result.current.sensorData['C123'].humidity.value).toBe(55);
});

test('constructs compositeId from object layer field', () => {
  const { result } = renderHook(() => useLiveDevices([SENSOR_TOPIC]));

  act(() => {
    global.__stompHandler(SENSOR_TOPIC, {
      deviceId: 'T01',
      layer: { layer: 'L01' },
      system: 'S01',
      sensors: [
        { sensorType: 'temperature', value: 20 },
        { sensorType: 'humidity', value: 50 }
      ]
    });
  });

  expect(result.current.sensorData['L01T01'].temperature.value).toBe(20);
});
