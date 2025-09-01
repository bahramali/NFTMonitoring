import { normalizeSensors, deriveFromSensors } from '../src/utils/normalizeSensors.js';

test('normalizeSensors canonicalizes keys and values', () => {
  const sensors = [
    { sensorType: 'temperature', value: '25.5', unit: '°C' },
    { sensorType: 'humidity', value: '50', unit: '%' },
    { sensorType: 'CO₂', value: '400', unit: 'ppm' },
    { sensorType: '555nm', value: '10', unit: 'raw' },
    { sensorType: 'dissolvedEC', value: 1.5, unit: 'mS/cm' },
  ];
  const result = normalizeSensors(sensors);
  expect(result.temperature.value).toBe(25.5);
  expect(result.humidity.value).toBe(50);
  expect(result.co2.value).toBe(400);
  expect(result.F5).toBe(10);
  expect(result.ec.value).toBe(1.5);
});

test('deriveFromSensors groups spectrum, other light, and water', () => {
  const sensors = [
    { sensorType: 'light', value: 100, unit: 'lux' },
    { sensorType: 'vis1', value: 2 },
    { sensorType: 'tds', value: 500, unit: 'ppm' },
    { sensorType: 'ec', value: 1.2, unit: 'mS/cm' },
    { sensorType: 'waterTemp', value: 20, unit: '°C' },
    { sensorType: 'do', value: 5, unit: 'mg/L' },
    { sensorType: '445nm', value: 12 },
  ];
  const { map, spectrum, otherLight, water } = deriveFromSensors(sensors);
  expect(Object.keys(map)).toHaveLength(0);
  expect(spectrum.F2).toBe(12);
  expect(otherLight.lux).toBe(100);
  expect(otherLight.vis1).toBe(2);
  expect(water.tds_ppm).toBe(500);
  expect(water.ec_mScm).toBe(1.2);
  expect(water.tempC).toBe(20);
  expect(water.do_mgL).toBe(5);
});
