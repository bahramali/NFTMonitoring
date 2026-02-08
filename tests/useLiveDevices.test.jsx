import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLiveDevices } from '../src/pages/common/useLiveDevices.js';
import { WS_TOPICS } from '../src/pages/common/dashboard.constants.js';
import tankPayload from './data/waterTank.json';
import oxyPayload from './data/oxygenPump.json';
import telemetryEnvelope from './data/wsTelemetryEnvelope.json';
import statusEnvelope from './data/wsStatusEnvelope.json';
import eventEnvelope from './data/wsEventEnvelope.json';
import { buildDeviceKey } from '../src/utils/deviceIdentity.js';

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
  ...overrides,
});

test('stores sensor data and actuator controllers per device key', () => {
  const { result } = renderHook(() =>
    useLiveDevices([TELEMETRY_TOPIC, 'actuator/oxygenPump'])
  );
  const telemetryKey = buildDeviceKey(telemetryEnvelope.payload);
  const tankKey = buildDeviceKey(tankPayload);
  const oxyKey = buildDeviceKey(oxyPayload);

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
    result.current.sensorData[telemetryKey].temperature.value
  ).toBeCloseTo(27.75);
  expect(result.current.sensorData[telemetryKey]).toBeDefined();
  expect(result.current.sensorData[tankKey]).toBeUndefined();
  expect(
    result.current.mergedDevices[oxyKey].controllers[0]
  ).toEqual(oxyPayload.controllers[0]);
});

test('aggregates devices across multiple farms', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        farmId: 'F01',
        unitType: 'rack',
        unitId: 'R01',
        layerId: 'L01',
        deviceId: 'G01',
        sensors: [{ sensorType: 'temperature', value: 20 }]
      })
    );
  });

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        farmId: 'F02',
        unitType: 'rack',
        unitId: 'R02',
        layerId: 'L02',
        deviceId: 'G02',
        sensors: [
          { sensorType: 'temperature', value: 25 },
          { sensorType: 'humidity', value: 50 }
        ]
      })
    );
  });

  const keyOne = 'F01|rack|R01|L01|UNKNOWN|G01';
  const keyTwo = 'F02|rack|R02|L02|UNKNOWN|G02';
  expect(result.current.availableDeviceKeys).toEqual(
    expect.arrayContaining([keyOne, keyTwo])
  );
  expect(result.current.sensorData[keyTwo].temperature.value).toBe(25);
});

test('merges controllers from multiple topics', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC, 'waterOutput']));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        farmId: 'F01',
        unitType: 'rack',
        unitId: 'R01',
        layerId: 'L01',
        deviceId: 'G01',
        controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }]
      })
    );
  });

  act(() => {
    global.__stompHandler('waterOutput', {
      farmId: 'F01',
      unitType: 'rack',
      unitId: 'R01',
      layerId: 'L01',
      deviceId: 'G01',
      controllers: [{ name: 'Pump1', type: 'pump', state: 'off' }]
    });
  });

  act(() => {
    global.__stompHandler('waterOutput', {
      farmId: 'F01',
      unitType: 'rack',
      unitId: 'R01',
      layerId: 'L01',
      deviceId: 'G01',
      controllers: [{ name: 'Pump1', type: 'pump', state: 'on' }]
    });
  });

  const deviceKey = 'F01|rack|R01|L01|UNKNOWN|G01';
  const ctrls = result.current.mergedDevices[deviceKey].controllers;
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
        farmId: 'F01',
        unitType: 'rack',
        unitId: 'R01',
        layerId: 'L01',
        deviceId: 'G01',
        controllers: [{ name: 'Valve1', type: 'valve', state: 'open' }],
      })
    );
  });

  act(() => {
    const payload = {
      farmId: 'F01',
      unitType: 'rack',
      unitId: 'R01',
      layerId: 'L01',
      deviceId: 'G01',
      controllers: [{ name: 'OxyPump', type: 'pump', state: 'off' }],
    };
    global.__stompHandler('actuator/oxygenPump', {
      payload: JSON.stringify(payload),
    });
  });

  act(() => {
    const payload = {
      farmId: 'F01',
      unitType: 'rack',
      unitId: 'R01',
      layerId: 'L01',
      deviceId: 'G01',
      controllers: [{ name: 'OxyPump', type: 'pump', state: 'on' }],
    };
    global.__stompHandler('actuator/oxygenPump', { payload });
  });

  const deviceKey = 'F01|rack|R01|L01|UNKNOWN|G01';
  const ctrls = result.current.mergedDevices[deviceKey].controllers;
  expect(ctrls).toHaveLength(2);
  const valve = ctrls.find((c) => c.name === 'Valve1');
  const pump = ctrls.find((c) => c.name === 'OxyPump');
  expect(valve.state).toBe('open');
  expect(pump.state).toBe('on');
});

test('ignores payloads missing identity fields', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        deviceId: 'T01',
        sensors: [
          { sensorType: 'temperature', value: 20 },
        ]
      })
    );
  });

  expect(Object.keys(result.current.sensorData)).toHaveLength(0);
});

test('captures auxiliary payload fields for non-sensor topics', () => {
  vi.useFakeTimers();
  const fixedDate = new Date('2024-01-01T00:00:00Z');
  vi.setSystemTime(fixedDate);

  const { result } = renderHook(() => useLiveDevices(['water_flow']));

  act(() => {
    global.__stompHandler('water_flow', {
      farmId: 'F01',
      unitType: 'rack',
      unitId: 'R03',
      layerId: 'L03',
      deviceId: 'WF01',
      status: 'on',
    });
  });

  const deviceKey = 'F01|rack|R03|L03|UNKNOWN|WF01';
  const topicEntry = result.current.deviceData['F01']['water_flow'][deviceKey];
  expect(topicEntry.extra).toEqual({ status: 'on' });
  expect(topicEntry.receivedAt).toBe(fixedDate.getTime());

  vi.useRealTimers();
});

test('adapts flat telemetry payloads into sensors and stores by device key', () => {
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC]));
  const flatPayload = {
    farmId: 'F77',
    unitType: 'rack',
    unitId: 'R07',
    layerId: 'L07',
    deviceId: 'G99',
    temperature: '22.5',
    humidity: 48
  };

  act(() => {
    global.__stompHandler(TELEMETRY_TOPIC, makeTelemetryEnvelope(flatPayload));
  });

  const deviceKey = 'F77|rack|R07|L07|UNKNOWN|G99';
  expect(result.current.sensorData[deviceKey].temperature.value).toBeCloseTo(22.5);
  expect(result.current.sensorData[deviceKey].humidity.value).toBe(48);
});

test('stores device events from event envelopes', () => {
  const { result } = renderHook(() => useLiveDevices(['hydroleaf/event']));

  act(() => {
    global.__stompHandler('hydroleaf/event', eventEnvelope);
  });

  const deviceKey = 'F01|rack|R01|L01|UNKNOWN|G01';
  expect(result.current.deviceEvents[deviceKey]).toHaveLength(1);
  expect(result.current.deviceEvents[deviceKey][0].event).toBe('watering');
});

test('resolves online state from status envelopes', () => {
  const { result } = renderHook(() => useLiveDevices(['hydroleaf/status']));

  act(() => {
    global.__stompHandler('hydroleaf/status', statusEnvelope);
  });

  const deviceKey = 'F01|rack|R01|L01|UNKNOWN|G01';
  expect(result.current.mergedDevices[deviceKey].online).toBe(true);
});

test('filters messages by page scope', () => {
  const scope = { farmId: 'F01', unitType: 'rack', unitId: 'R01', layerId: 'L01' };
  const { result } = renderHook(() => useLiveDevices([TELEMETRY_TOPIC], { scope }));

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        farmId: 'F01',
        unitType: 'rack',
        unitId: 'R01',
        layerId: 'L01',
        deviceId: 'G10',
        sensors: [
          { sensorType: 'temperature', value: 20 },
          { sensorType: 'humidity', value: 50 }
        ]
      })
    );
  });

  act(() => {
    global.__stompHandler(
      TELEMETRY_TOPIC,
      makeTelemetryEnvelope({
        farmId: 'F01',
        unitType: 'rack',
        unitId: 'R01',
        layerId: 'L02',
        deviceId: 'G11',
        sensors: [{ sensorType: 'temperature', value: 21 }],
      })
    );
  });

  const includedKey = 'F01|rack|R01|L01|UNKNOWN|G10';
  expect(result.current.sensorData[includedKey]).toBeDefined();
  const excludedKey = 'F01|rack|R01|L02|UNKNOWN|G11';
  expect(result.current.sensorData[excludedKey]).toBeUndefined();
});
