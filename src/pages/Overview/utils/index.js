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

const sanitizeMetricKey = (raw) =>
  String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const METRIC_META = {
  light: { unit: "lux", precision: 0, rangeKey: "lux" },
  temperature: { unit: "°C", precision: 1, rangeKey: "temperature" },
  humidity: { unit: "%", precision: 1, rangeKey: "humidity" },
  co2: { unit: "ppm", precision: 0, rangeKey: "co2" },
  ph: { unit: "", precision: 1, rangeKey: "ph" },
  dissolvedoxygen: { unit: "mg/L", precision: 1, rangeKey: "dissolvedOxygen" },
  dissolvedec: { unit: "mS/cm", precision: 2, rangeKey: "ec" },
  dissolvedtds: { unit: "ppm", precision: 0, rangeKey: "tds" },
  dissolvedtemp: { unit: "°C", precision: 1, rangeKey: "dissolvedTemp" },
};

const METRIC_ORDER = [
  "light",
  "temperature",
  "humidity",
  "ph",
  "co2",
  "dissolvedtemp",
  "dissolvedoxygen",
  "dissolvedec",
  "dissolvedtds",
];

const SPECTRAL_MATCHERS = [
  (key) => /^f\d{1,2}$/i.test(key),
  (key) => /^\d{3}nm$/i.test(key),
  (key) => /^(?:vis1|vis2|clear|nir|nir855)$/i.test(key),
  (key) => /as7343/i.test(key),
];

const DEFAULT_EXCLUDED = new Set(["health"]);

const shouldSkipMetricKey = (rawKey) => {
  const safe = String(rawKey || "").trim();
  if (!safe) return true;
  const sanitized = sanitizeMetricKey(safe);
  if (!sanitized) return true;
  if (DEFAULT_EXCLUDED.has(sanitized)) return true;
  return SPECTRAL_MATCHERS.some((matcher) => matcher(safe));
};

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

export function aggregateFromCards(cards = []) {
  const sums = {};
  const counts = {};
  const units = {};
  const order = [];
  const displayKeys = {};

  for (const card of cards || []) {
    const sensors = card?.sensors || {};
    for (const [rawKey, reading] of Object.entries(sensors)) {
      if (shouldSkipMetricKey(rawKey)) continue;

      const displayKey = String(rawKey || "").trim();
      const metricKey = sanitizeMetricKey(displayKey);
      if (!metricKey) continue;

      const rawValue = typeof reading === "number" ? reading : reading?.value;
      const numeric = rawValue == null ? null : Number(rawValue);
      if (!Number.isFinite(numeric)) continue;

      if (!order.includes(metricKey)) order.push(metricKey);
      if (!displayKeys[metricKey]) displayKeys[metricKey] = displayKey || metricKey;

      sums[metricKey] = (sums[metricKey] || 0) + numeric;
      counts[metricKey] = (counts[metricKey] || 0) + 1;

      const unit = reading?.unit;
      if (unit && !units[metricKey]) units[metricKey] = unit;
    }
  }

  const avg = {};
  Object.keys(sums).forEach((key) => {
    const count = counts[key];
    if (count) {
      avg[key] = sums[key] / count;
    }
  });

  return { avg, counts, units, order, displayKeys };
}

const sensorCountLabel = (count) => `${count} sensor${count === 1 ? "" : "s"}`;

const sortAggregatedKeys = (keys = [], displayKeys = {}) => {
  const getOrderIndex = (key) => {
    const idx = METRIC_ORDER.indexOf(key);
    return idx === -1 ? Infinity : idx;
  };

  return [...keys].sort((a, b) => {
    const orderA = getOrderIndex(a);
    const orderB = getOrderIndex(b);
    if (orderA !== orderB) return orderA - orderB;
    const labelA = (displayKeys[a] ?? a).toString();
    const labelB = (displayKeys[b] ?? b).toString();
    return labelA.localeCompare(labelB);
  });
};

export function buildAggregatedEntries(agg, { topic, findRange } = {}) {
  if (!agg) return [];

  const keys = sortAggregatedKeys(
    (agg.order && agg.order.length ? agg.order : Object.keys(agg.avg || {})).filter(
      (key) => agg.counts?.[key] > 0
    ),
    agg.displayKeys
  );

  return keys.map((key) => {
    const meta = METRIC_META[key] || {};
    const precision = meta.precision ?? 1;
    const unit = agg.units?.[key] ?? meta.unit ?? "";
    const labelSource = agg.displayKeys?.[key] ?? key;
    const label = sensorLabel(labelSource, { topic }) ?? labelSource;
    const value = fmt(agg.avg?.[key], precision);
    const formattedValue = unit ? `${value} ${unit}` : value;
    const rangeKey = meta.rangeKey ?? labelSource;
    const range = typeof findRange === "function" ? findRange(rangeKey, { topic }) : undefined;

    return {
      key,
      label,
      value: formattedValue,
      count: agg.counts?.[key] ?? 0,
      countLabel: sensorCountLabel(agg.counts?.[key] ?? 0),
      range,
    };
  });
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
  buildAggregatedEntries,
  isWaterDevice,
};
