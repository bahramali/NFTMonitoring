import React from "react";
import { useStomp } from "../../../hooks/useStomp";
import { normalizeSensors } from "../utils";

export default function useLayerCompositeCards(systemKeyInput, layerId) {
  const [cards, setCards] = React.useState({});
  const layerKey = String(layerId || "").toUpperCase();
  const sysKey = String(systemKeyInput || "").toUpperCase();

  const isMine = React.useCallback((compId, data) => {
    const cid = String(compId || "").trim().toUpperCase();
    if (cid) {
      if (!cid.startsWith(`${sysKey}-`)) return false;
      if (!cid.includes(`-${layerKey}-`)) return false;
      return true;
    }
    const sys = String(data?.system || data?.systemId || "").trim().toUpperCase();
    const lay = String(data?.layer || data?.layerId || "").trim().toUpperCase();
    if (sysKey && sys && sys !== sysKey) return false;
    if (layerKey && lay && lay !== layerKey) return false;
    return !!sys && !!lay;
  }, [sysKey, layerKey]);

  const upsert = React.useCallback((compId, sensors, ts) => {
    setCards(prev => {
      const next = {...prev};
      const cur = next[compId] || {sensors: {}, ts: 0};
      const normalized = normalizeSensors(sensors);
      for (const [k, obj] of Object.entries(normalized)) {
        cur.sensors[k] = {value: obj.value, unit: obj.unit};
      }
      cur.ts = Math.max(cur.ts || 0, ts || Date.now());
      next[compId] = cur;
      return next;
    });
  }, []);

  const topics = React.useMemo(() => ["/topic/growSensors", "/topic/waterTank"], []);
  useStomp(topics, (topic, data) => {
    if (!data) return;
    let compId = data.compositeId || data.composite_id || data.cid;
    if (!compId) {
      const sys = data.system || data.systemId;
      const lay = data.layer || data.layerId;
      const dev = data.deviceId || data.device || data.devId;
      if (sys && lay && dev) compId = `${sys}-${lay}-${dev}`;
    }
    if (!compId) return;
    if (!isMine(compId, data)) return;
    const sensors = data.sensors || data.values || data.env || data.water || data.payload || data.readings || [];
    upsert(compId, sensors, data.timestamp || data.ts);
  });

  React.useEffect(() => {
    setCards({});
  }, [sysKey, layerKey]);

  return React.useMemo(() => Object.entries(cards).map(([compId, payload]) => ({compId, ...payload})).sort((a, b) => String(a.compId).localeCompare(String(b.compId))), [cards]);
}
