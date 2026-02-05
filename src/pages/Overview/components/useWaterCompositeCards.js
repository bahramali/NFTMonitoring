import React from "react";
import { useStomp } from "../../../hooks/useStomp";
import { normalizeSensors, isWaterDevice } from "../utils";
import { HYDROLEAF_TOPICS, normalizeTelemetryPayload, parseEnvelope } from "../../../utils/telemetryAdapter.js";
import { buildDeviceKey, resolveIdentity } from "../../../utils/deviceIdentity.js";

export default function useWaterCompositeCards(systemKeyInput) {
  const [cards, setCards] = React.useState({});
  const farmKey = String(systemKeyInput || "").toUpperCase();

  const isMine = React.useCallback((identity) => {
    const farm = String(identity?.farmId || "").trim().toUpperCase();
    const deviceId = String(identity?.deviceId || "").trim().toUpperCase();
    if (farmKey && farm && farm !== farmKey) return false;
    return isWaterDevice(deviceId);
  }, [farmKey]);

  const upsert = React.useCallback((deviceKey, identity, sensors, ts) => {
    setCards(prev => {
      const next = {...prev};
      const cur = next[deviceKey] || {sensors: {}, rawSensors: [], ts: 0};
      cur.identity = identity;
      const normalized = normalizeSensors(sensors);
      for (const [k, obj] of Object.entries(normalized)) {
        if (obj && typeof obj === "object") {
          cur.sensors[k] = { value: obj.value, unit: obj.unit, sensorType: obj.sensorType ?? k };
        } else {
          cur.sensors[k] = { value: obj, unit: undefined, sensorType: k };
        }
      }
      cur.rawSensors = Array.isArray(sensors)
        ? sensors.map((sensor) => {
            const sensorType =
              sensor?.sensorType ??
              sensor?.valueType ??
              sensor?.type ??
              sensor?.name ??
              "";
            const unit = sensor?.unit || sensor?.units || sensor?.u || "";
            return {
              sensorType,
              value: sensor?.value,
              unit,
              sensorName: sensor?.sensorName ?? sensor?.name ?? sensor?.source ?? "",
            };
          })
        : [];
      cur.ts = Math.max(cur.ts || 0, ts || Date.now());
      next[deviceKey] = cur;
      return next;
    });
  }, []);

  const topics = React.useMemo(() => HYDROLEAF_TOPICS, []);
  useStomp(topics, (_topic, data) => {
    if (!data) return;
    const envelope = parseEnvelope(data);
    const telemetry = normalizeTelemetryPayload(envelope);
    if (envelope && envelope.kind !== "telemetry") return;
    const message = telemetry || data;

    const identity = resolveIdentity(message, envelope);
    const deviceKey = buildDeviceKey(identity);
    if (!deviceKey) return;
    if (!isMine(identity)) return;
    const sensors = message.sensors || message.values || message.env || message.water || message.payload || message.readings || [];
    upsert(deviceKey, identity, sensors, message.timestamp || message.ts);
  });

  React.useEffect(() => { setCards({}); }, [farmKey]);

  return React.useMemo(
    () =>
      Object.entries(cards)
        .map(([deviceKey, payload]) => ({
          deviceKey,
          ...payload,
          deviceId: payload.identity?.deviceId,
          layerId: payload.identity?.layerId,
          unitId: payload.identity?.unitId,
          unitType: payload.identity?.unitType,
          farmId: payload.identity?.farmId,
        }))
        .sort((a, b) => String(a.deviceKey).localeCompare(String(b.deviceKey))),
    [cards]
  );
}
