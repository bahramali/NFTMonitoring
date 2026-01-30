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

const FLAT_TELEMETRY_IGNORED_KEYS = new Set([
  "timestamp",
  "site",
  "rack",
  "layer",
  "deviceId",
  "compositeId",
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
    compositeId: message.compositeId ?? payload?.compositeId ?? payload?.composite_id ?? null,
    kind: message.kind,
    deviceId: message.deviceId ?? message.device_id ?? payload?.deviceId ?? payload?.device_id ?? null,
    siteId: message.siteId ?? message.site_id ?? payload?.siteId ?? payload?.site_id ?? null,
    rackId: message.rackId ?? message.rack_id ?? payload?.rackId ?? payload?.rack_id ?? null,
    nodeType: message.nodeType ?? message.node_type ?? payload?.nodeType ?? payload?.node_type ?? null,
    nodeId: message.nodeId ?? message.node_id ?? payload?.nodeId ?? payload?.node_id ?? null,
    nodeInstance:
      message.nodeInstance ??
      message.node_instance ??
      payload?.nodeInstance ??
      payload?.node_instance ??
      null,
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
  const compositeId = payload.compositeId ?? envelope.compositeId;
  const deviceId = payload.deviceId ?? payload.device_id ?? envelope.deviceId;
  const siteId = payload.siteId ?? payload.site_id ?? payload.site ?? envelope.siteId ?? envelope.site;
  const rackId = payload.rackId ?? payload.rack_id ?? payload.rack ?? envelope.rackId ?? envelope.rack;
  const nodeType = payload.nodeType ?? payload.node_type ?? envelope.nodeType;
  const nodeId = payload.nodeId ?? payload.node_id ?? envelope.nodeId;
  const nodeInstance =
    payload.nodeInstance ?? payload.node_instance ?? envelope.nodeInstance ?? envelope.node_instance;
  const timestamp =
    payload.timestamp ?? payload.ts ?? payload.time ?? payload.receivedAt ?? envelope.timestamp ?? null;
  const systemId = payload.systemId ?? payload.system ?? siteId;
  const layerId = payload.layerId ?? payload.layer ?? (nodeType === "LAYER" ? nodeId : undefined);
  const resolvedCompositeId =
    compositeId ??
    (siteId && nodeId && deviceId
      ? `${siteId}${rackId ? `-${rackId}` : ""}-${nodeId}-${deviceId}`
      : null);

  return {
    ...payload,
    sensors,
    ...(resolvedCompositeId ? { compositeId: resolvedCompositeId } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(rackId ? { rackId } : {}),
    ...(nodeType ? { nodeType } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(nodeInstance !== null && nodeInstance !== undefined ? { nodeInstance } : {}),
    ...(systemId ? { systemId } : {}),
    ...(layerId ? { layerId } : {}),
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
