import { getMetricOverviewLabel } from "../../../config/sensorMetrics.js";
import { isWaterDevice } from "./isWaterDevice.js";
export { isWaterDevice } from "./isWaterDevice.js";

export const toNum = (v) => (v == null || v === "" ? null : Number(v));

export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "--" : Number(v).toFixed(d));

export const localDateTime = (ms) => {
  try {
    return ms ? new Date(ms).toLocaleString() : "--";
  } catch {
    return "--";
  }
};

export const normLayerId = (l) => {
  const raw = l?.id ?? l?.layerId ?? "";
  if (/^L\d+$/i.test(raw)) return raw.toUpperCase();
  const m = /^layer(\d+)$/i.exec(raw || "");
  return m ? `L${String(m[1]).padStart(2, "0")}` : (raw || "--");
};

const fixSubs = (s) => String(s).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(d)]);

export function getMetric(obj, key) {
  if (!obj) return null;
  const val = obj[key] ?? obj[key?.toLowerCase()] ?? obj[key?.toUpperCase()];
  if (val == null) return null;
  return typeof val === "object" ? toNum(val.average ?? val.avg ?? val.value) : toNum(val);
}

export function getCount(obj, key) {
  if (!obj) return 0;
  const v = obj[key] ?? obj[key?.toLowerCase()] ?? obj[key?.toUpperCase()];
  if (v && typeof v === "object") {
    const n = v.deviceCount ?? v.count ?? v.sensorCount;
    return typeof n === "number" ? n : 0;
  }
  return v != null ? 1 : 0;
}

export function deriveHealth(layer) {
  const e = layer.environment || {};
  const present = ["light", "temperature", "humidity"].map(k => getMetric(e, k)).filter(v => v != null).length;
  return present === 0 ? "down" : present < 3 ? "warn" : "ok";
}

export const sensorLabel = (k, context) => getMetricOverviewLabel(k, context);

export function canonKey(raw) {
  const base = fixSubs(String(raw || "")).toLowerCase();
  const normalized = base.replace(/[\s_-]/g, "");
  if (!normalized) return null;
  if (["light", "lux", "illumination"].includes(normalized)) return "light";
  if (["temperature", "temp", "tempc", "temperaturec", "airtemp", "airtempc", "airtemperature", "airtemperaturec"].includes(normalized)) {
    return "temperature";
  }
  if ([
    "humidity",
    "hum",
    "rh",
    "rhpct",
    "humiditypct",
    "humiditypercent",
    "relativehumidity",
    "relativehumiditypct",
    "relativehumiditypercent",
  ].includes(normalized)) {
    return "humidity";
  }
  if (normalized === "co2" || normalized === "co2ppm") return "co2";
  if (normalized === "ph") return "pH";
  if (normalized === "do" || normalized === "dissolvedoxygen") return "dissolvedOxygen";
  if (normalized === "ec" || normalized === "dissolvedec") return "dissolvedEC";
  if (normalized === "tds" || normalized === "dissolvedtds") return "dissolvedTDS";
  if (normalized === "watertemp" || normalized === "dissolvedtemp") return "dissolvedTemp";
  return raw;
}

export function normalizeSensors(src) {
  const out = {};
  if (!src) return out;
  if (Array.isArray(src)) {
    for (const s of src) {
      const k = canonKey(s?.sensorType ?? s?.type ?? s?.name);
      const val = toNum(s?.value);
      const unit = s?.unit || s?.units || s?.u;
      if (k && val != null) out[k] = {value: val, unit};
    }
    return out;
  }
  if (typeof src === "object") {
    for (const [k, v] of Object.entries(src)) {
      const key = canonKey(k);
      if (v && typeof v === "object") {
        const val = toNum(v.value ?? v.avg ?? v.average ?? v.v);
        const unit = v.unit || v.u;
        if (val != null) out[key] = {value: val, unit};
      } else if (v != null) {
        out[key] = {value: toNum(v)};
      }
    }
  }
  return out;
}

export function aggregateFromCards(cards) {
  const keys = ["light", "temperature", "humidity", "pH", "co2"];
  const sums = {}, counts = {};
  for (const c of cards || []) {
    const s = c?.sensors || {};
    for (const k of keys) {
      const v = s[k]?.value;
      const n = v == null ? null : Number(v);
      if (n != null && !Number.isNaN(n)) {
        sums[k] = (sums[k] || 0) + n;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  }
  const avg = {};
  Object.keys(sums).forEach(k => (avg[k] = sums[k] / counts[k]));
  return {avg, counts};
}

export default {
  toNum,
  fmt,
  localDateTime,
  normLayerId,
  getMetric,
  getCount,
  deriveHealth,
  sensorLabel,
  canonKey,
  normalizeSensors,
  aggregateFromCards,
  isWaterDevice,
};
