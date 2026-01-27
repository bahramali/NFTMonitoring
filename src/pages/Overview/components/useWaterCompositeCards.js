import React from "react";
import { useStomp } from "../../../hooks/useStomp";
import { normalizeSensors, isWaterDevice } from "../utils";
import { HYDROLEAF_TOPICS, normalizeTelemetryPayload, parseEnvelope } from "../../../utils/telemetryAdapter.js";

export default function useWaterCompositeCards(systemKeyInput) {
  const [cards, setCards] = React.useState({});
  const sysKey = String(systemKeyInput || "").toUpperCase();

  const isMine = React.useCallback((compId, data) => {
    const cid = String(compId || "").trim().toUpperCase();
    if (cid) {
      if (!cid.startsWith(`${sysKey}-`)) return false;
      if (!isWaterDevice(cid)) return false;
      return true;
    }
    const sys = String(data?.system || data?.systemId || "").trim().toUpperCase();
    const dev = String(data?.deviceId || data?.device || data?.devId || "").trim().toUpperCase();
    if (sysKey && sys && sys !== sysKey) return false;
    return !!sys && dev.startsWith("T");
  }, [sysKey]);

  const upsert = React.useCallback((compId, sensors, ts) => {
    setCards(prev => {
      const next = {...prev};
      const cur = next[compId] || {sensors: {}, rawSensors: [], ts: 0};
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
      next[compId] = cur;
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

    let compId = message.compositeId || message.composite_id || message.cid;
    if (!compId) {
      const sys = message.system || message.systemId;
      const lay = message.layer || message.layerId;
      const dev = message.deviceId || message.device || message.devId;
      if (sys && lay && dev) compId = `${sys}-${lay}-${dev}`;
    }
    if (!compId) return;
    if (!isMine(compId, message)) return;
    const sensors = message.sensors || message.values || message.env || message.water || message.payload || message.readings || [];
    upsert(compId, sensors, message.timestamp || message.ts);
  });

  React.useEffect(() => { setCards({}); }, [sysKey]);

  return React.useMemo(() => Object.entries(cards).map(([compId, payload]) => ({compId, ...payload})).sort((a,b) => String(a.compId).localeCompare(String(b.compId))), [cards]);
}
