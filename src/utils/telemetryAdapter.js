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
  "system",
  "systemId",
  "layer",
  "layerId",
  "compositeId",
  "composite_id",
  "cid",
  "meta",
  "health",
  "controllers",
  "status",
  "online",
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
    compositeId: message.compositeId ?? payload?.compositeId ?? payload?.composite_id ?? null,
    kind: message.kind,
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
          sensorType: `as7343_counts_${bandKey}`,
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

  return {
    ...payload,
    sensors,
    compositeId: payload.compositeId ?? envelope.compositeId,
  };
}
