import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveDevices } from '../src/pages/common/useLiveDevices.js';
import { WS_TOPICS } from '../src/pages/common/dashboard.constants.js';
import tankPayload from './data/waterTank.json';
import oxyPayload from './data/oxygenPump.json';
import telemetryEnvelope from './data/wsTelemetryEnvelope.json';
import statusEnvelope from './data/wsStatusEnvelope.json';
import eventEnvelope from './data/wsEventEnvelope.json';

// Mock useStomp to capture the message handler
vi.mock('../src/hooks/useStomp', () => ({
  useStomp: (_topics, onMessage) => {
    global.__stompHandler = onMessage;
  }
}));

const TELEMETRY_TOPIC =
  WS_TOPICS.find((topic) => topic?.includes('telemetry')) || 'hydroleaf/telemetry';

const makeTelemetryEnvelope = (payload, overrides = {}) => ({
  ...telemetryEnvelope,
  payload,
  compositeId: payload?.compositeId ?? telemetryEnvelope.compositeId,
  ...overrides,
});

test('stores sensor data and actuator controllers per composite device', () => {
  const { result } = renderHook(() =>
    useLiveDevices([TELEMETRY_TOPIC, 'actuator/oxygenPump'])
  );

  act(() => {
    global.__stompHandler(TELEMETRY_TOPIC, telemetryEnvelope);
  });

  act(() => {
    global.__stompHandler(TELEMETRY_TOPIC, makeTelemetryEnvelope(tankPayload));
  });

  act(() => {
    global.__stompHandler('actuator/oxygenPump', oxyPayload);
  });

  expect(
    result.current.sensorData[telemetryEnvelope.payload.compositeId].temperature.value
  ).toBeCloseTo(27.75);
  expect(result.current.sensorData[telemetryEnvelope.payload.compositeId]).toBeDefined();
  expect(result.current.sensorData[tankPayload.compositeId]).toBeUndefined();
  expect(
    result.current.mergedDevices[oxyPayload.compositeId].controllers[0]
  ).toEqual(oxyPayload.controllers[0]);
});

test('aggregates devices across multiple systems', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'G01',
        layer: 'L01',
        system: 'S01',
        sensors: [{ sensorType: 'temperature', value: 20 }]
      })
    );
  });

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'G02',
        layer: 'L02',
        system: 'S02',
        sensors: [
          { sensorType: 'temperature', value: 25 },
          { sensorType: 'humidity', value: 50 }
        ]
      })
    );
  });

  expect(result.current.availableCompositeIds).toEqual(
    expect.arrayContaining(['S01-L01-G01', 'S02-L02-G02'])
  );
  expect(result.current.sensorData['S02-L02-G02'].temperature.value).toBe(25);
});

test('merges controllers from multiple topics', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC, 'waterOutput']));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'G01',
        layer: 'L01',
        system: 'S01',
        controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }]
      })
    );
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

  const ctrls = result.current.mergedDevices['S01-L01-G01'].controllers;
  expect(ctrls).toHaveLength(2);
  const valve = ctrls.find(c => c.name === 'Valve1');
  const pump = ctrls.find(c => c.name === 'Pump1');
  expect(valve.state).toBe('open');
  expect(pump.state).toBe('on');
});

test('handles actuator payloads with JSON payload and merges controllers', () => {
  const { result } = renderHook(() =>
    useLiveDevices([TELEMETRY_TOPIC, 'actuator/oxygenPump'])
  );

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'G01',
        layer: 'L01',
        system: 'S01',
        controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }],
      })
    );
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

  const ctrls = result.current.mergedDevices['S01-L01-G01'].controllers;
  expect(ctrls).toHaveLength(2);
  const valve = ctrls.find((c) => c.name === 'Valve1');
  const pump = ctrls.find((c) => c.name === 'OxyPump');
  expect(valve.state).toBe('open');
  expect(pump.state).toBe('on');
});

test('uses provided compositeId when present', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        compositeId: 'C123',
        deviceId: 'ignored',
        layer: 'L99',
        system: 'S01',
        sensors: [
          { sensorType: 'temperature', value: '22' },
          { sensorType: 'humidity', value: '55' }
        ]
      })
    );
  });

  expect(result.current.sensorData['C123'].temperature.value).toBe(22);
  expect(result.current.sensorData['C123'].humidity.value).toBe(55);
});

test('constructs compositeId from object layer field', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'T01',
        layer: { layer: 'L01' },
        system: 'S01',
        sensors: [
          { sensorType: 'temperature', value: 20 },
          { sensorType: 'humidity', value: 50 }
        ]
      })
    );
  });

  expect(result.current.sensorData['S01-L01-T01'].temperature.value).toBe(20);
});

test('captures auxiliary payload fields for non-sensor topics', () => {
  vi.useFakeTimers();
  const fixedDate = new Date('2024-01-01T00:00:00Z');
  vi.setSystemTime(fixedDate);

  const { result } = renderHook(() => useLiveDevices(['water_flow']));

  act(() => {
    global.__stompHandler('water_flow', {
      deviceId: 'WF01',
      layer: 'L03',
      system: 'SYS01',
      status: 'on',
    });
  });

  const topicEntry = result.current.deviceData['SYS01']['water_flow']['SYS01-L03-WF01'];
  expect(topicEntry.extra).toEqual({ status: 'on' });
  expect(topicEntry.receivedAt).toBe(fixedDate.getTime());

  vi.useRealTimers();
});

test('adapts flat telemetry payloads into sensors and stores by compositeId', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));
  const flatPayload = {
    deviceId: 'G99',
    layer: 'L07',
    system: 'S77',
    compositeId: 'S77-L07-G99',
    temperature: '22.5',
    humidity: 48
  };

  act(() => {
    global.__stompHandler(TELEMETRY_TOPIC, makeTelemetryEnvelope(flatPayload));
  });

  expect(result.current.sensorData['S77-L07-G99'].temperature.value).toBeCloseTo(22.5);
  expect(result.current.sensorData['S77-L07-G99'].humidity.value).toBe(48);
});

test('stores device events from event envelopes', () => {
  const { result } = renderHook(() => useLiveDevices(['hydroleaf/event']));

  act(() => {
    global.__stompHandler('hydroleaf/event', eventEnvelope);
  });

  expect(result.current.deviceEvents['S01-L01-G01']).toHaveLength(1);
  expect(result.current.deviceEvents['S01-L01-G01'][0].event).toBe('watering');
});

test('resolves online state from status envelopes', () => {
  const { result } = renderHook(() => useLiveDevices(['hydroleaf/status']));

  act(() => {
    global.__stompHandler('hydroleaf/status', statusEnvelope);
  });

  expect(result.current.mergedDevices['S01-L01-G01'].online).toBe(true);
});
