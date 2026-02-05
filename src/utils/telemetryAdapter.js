const NUMERIC_UNITS = {
  lux: "lux",
  layer_temp_c: "C",
};

const RESERVED_TELEMETRY_KEYS = new Set([
  "timestamp",
  "ts",
  "time",
  "deviceId",
  "device",
  "devId",
  "layerId",
  "farmId",
  "farm_id",
  "unitType",
  "unit_type",
  "unitId",
  "unit_id",
  "meta",
  "health",
  "controllers",
  "status",
  "online",
]);

const FLAT_TELEMETRY_IGNORED_KEYS = new Set([
  "timestamp",
  "site",
  "rack",
  "layer",
  "deviceId",
  "farmId",
  "unitType",
  "unitId",
  "layerId",
  "receivedAt",
  "meta",
]);

const coerceNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const HYDROLEAF_TOPICS = [
  "/topic/hydroleaf/telemetry",
  "/topic/hydroleaf/status",
  "/topic/hydroleaf/event",
];

export function parseEnvelope(message) {
  if (!message || typeof message !== "object") return null;
  if (!("kind" in message) || !("payload" in message)) return null;

  let payload = message.payload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = message.payload;
    }
  }

  return {
    kind: message.kind,
    deviceId: message.deviceId ?? message.device_id ?? payload?.deviceId ?? payload?.device_id ?? null,
    farmId: message.farmId ?? message.farm_id ?? payload?.farmId ?? payload?.farm_id ?? null,
    unitType: message.unitType ?? message.unit_type ?? payload?.unitType ?? payload?.unit_type ?? null,
    unitId: message.unitId ?? message.unit_id ?? payload?.unitId ?? payload?.unit_id ?? null,
    layerId: message.layerId ?? message.layer_id ?? payload?.layerId ?? payload?.layer_id ?? null,
    timestamp: message.timestamp ?? payload?.timestamp ?? payload?.ts ?? payload?.time ?? null,
    payload,
  };
}

export function buildSensorsFromTelemetry(payload = {}) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.sensors)) return payload.sensors;

  const sensors = [];

  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_TELEMETRY_KEYS.has(key)) continue;
    if (key === "as7343_counts" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [bandKey, bandValue] of Object.entries(value)) {
        const numeric = coerceNumber(bandValue);
        if (numeric === null) continue;
        sensors.push({
          sensorType: bandKey,
          value: numeric,
          unit: "counts",
          sensorName: "as7343",
        });
      }
      continue;
    }

    const numeric = coerceNumber(value);
    if (numeric === null) continue;

    sensors.push({
      sensorType: key,
      value: numeric,
      unit: NUMERIC_UNITS[key],
    });
  }

  return sensors;
}

export function normalizeTelemetryPayload(envelope) {
  if (!envelope || envelope.kind !== "telemetry") return null;
  const payload = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {};
  const sensors = Array.isArray(payload.sensors) ? payload.sensors : buildSensorsFromTelemetry(payload);
  const deviceId = payload.deviceId ?? payload.device_id ?? envelope.deviceId;
  const farmId = payload.farmId ?? payload.farm_id ?? envelope.farmId;
  const unitType = payload.unitType ?? payload.unit_type ?? envelope.unitType;
  const unitId = payload.unitId ?? payload.unit_id ?? envelope.unitId;
  const layerId = payload.layerId ?? payload.layer_id ?? envelope.layerId ?? null;
  const timestamp =
    payload.timestamp ?? payload.ts ?? payload.time ?? payload.receivedAt ?? envelope.timestamp ?? null;

  return {
    ...payload,
    sensors,
    ...(deviceId ? { deviceId } : {}),
    ...(farmId ? { farmId } : {}),
    ...(unitType ? { unitType } : {}),
    ...(unitId ? { unitId } : {}),
    ...(layerId !== null && layerId !== undefined ? { layerId } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
}

export function adaptFlatTelemetryToSensors(flatPayload) {
  if (!flatPayload || typeof flatPayload !== "object" || Array.isArray(flatPayload)) {
    return { sensors: [], meta: {} };
  }

  const sensors = [];
  const meta =
    flatPayload.meta && typeof flatPayload.meta === "object" && !Array.isArray(flatPayload.meta)
      ? { ...flatPayload.meta }
      : {};

  for (const [key, value] of Object.entries(flatPayload)) {
    if (FLAT_TELEMETRY_IGNORED_KEYS.has(key)) {
      if (key !== "meta") {
        meta[key] = value;
      }
      continue;
    }

    if (key === "as7343_counts" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [bandKey, bandValue] of Object.entries(value)) {
        const numeric = coerceNumber(bandValue);
        if (numeric === null) continue;
        sensors.push({
          sensorType: bandKey,
          value: numeric,
          unit: "counts",
          sensorName: "as7343",
        });
      }
      continue;
    }

    const numeric = coerceNumber(value);
    if (numeric === null) continue;

    sensors.push({
      sensorType: key,
      value: numeric,
      unit: "",
    });
  }

  return { sensors, meta };
}
