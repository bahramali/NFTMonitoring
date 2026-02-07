import { DEVICE_HEALTH_CONFIG, METRIC_DEFINITIONS } from "../../../config/deviceMonitoring.js";

const METRIC_ALIASES = {
  airtemp: "airTemp",
  airtemperature: "airTemp",
  atemp: "airTemp",
  temperature: "airTemp",
  humidity: "rh",
  rh: "rh",
  relativehumidity: "rh",
  light: "light",
  lux: "light",
  illumination: "light",
  co2: "co2",
  ph: "ph",
  ec: "ec",
  dissolvedec: "ec",
  tds: "tds",
  solutiontemp: "solutionTemp",
  watertemp: "waterTemp",
  water_temp: "waterTemp",
  dissolvedtemp: "waterTemp",
};

const SPECTRAL_MATCHERS = [
  (key) => /^f\d{1,2}$/i.test(key),
  (key) => /^\d{3}nm$/i.test(key),
  (key) => /^(?:vis1|vis2|clear|nir|nir855)$/i.test(key),
];

const sanitizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const normalizeDeviceKind = (value) => {
  if (!value) return "UNKNOWN";
  const upper = String(value).trim().toUpperCase();
  return DEVICE_HEALTH_CONFIG.kinds[upper] ? upper : upper;
};

export const resolveExpectedConfig = (deviceKind) => {
  const normalized = normalizeDeviceKind(deviceKind);
  const config = DEVICE_HEALTH_CONFIG.kinds[normalized];
  return {
    kind: normalized,
    expectedIntervalSec: config?.expectedIntervalSec ?? DEVICE_HEALTH_CONFIG.defaultExpectedIntervalSec,
    expectedMetrics: config?.metrics ?? { critical: [], optional: [] },
  };
};

export const computeExpectedRatePerMinute = (expectedIntervalSec) => {
  if (!expectedIntervalSec || !Number.isFinite(expectedIntervalSec)) return null;
  return Math.max(1, Math.round((60 / expectedIntervalSec) * 10) / 10);
};

export const computeDataQuality = (metrics, expectedMetrics) => {
  const critical = expectedMetrics?.critical ?? [];
  const optional = expectedMetrics?.optional ?? [];
  const expectedAll = [...critical, ...optional];
  const present = expectedAll.filter((key) => metrics && metrics[key] != null);
  const percent = expectedAll.length ? Math.round((present.length / expectedAll.length) * 100) : 100;
  const missingCritical = critical.filter((key) => !metrics || metrics[key] == null);
  const missingOptional = optional.filter((key) => !metrics || metrics[key] == null);

  return {
    expected: expectedAll.length,
    received: present.length,
    percent,
    missingCritical,
    missingOptional,
  };
};

export const HEALTH_PRIORITY = ["offline", "critical", "degraded", "ok"];

export const getWorstHealthStatus = (statuses = []) => {
  if (!Array.isArray(statuses) || statuses.length === 0) return "ok";
  return statuses.reduce((worst, status) => {
    const currentIndex = HEALTH_PRIORITY.indexOf(status);
    const worstIndex = HEALTH_PRIORITY.indexOf(worst);
    if (currentIndex === -1) return worst;
    if (worstIndex === -1) return status;
    return currentIndex < worstIndex ? status : worst;
  }, "ok");
};

export const KEY_METRICS_BY_KIND = {
  TANK: ["ph", "ec", "solutionTemp"],
  ENV: ["airTemp", "rh", "co2"],
  GERMINATION: ["airTemp", "rh", "waterTemp", "light"],
  LAYER: ["airTemp", "rh", "light", "co2"],
};

export const METRIC_TREND_THRESHOLDS = {
  airTemp: 0.5,
  rh: 2,
  co2: 25,
  light: 50,
  ph: 0.1,
  ec: 0.05,
  solutionTemp: 0.4,
  waterTemp: 0.4,
};

export const getTrendDirection = (delta, threshold) => {
  if (delta == null || !Number.isFinite(delta)) return "flat";
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
};

export const computeMetricTrend = ({
  samples,
  metricKey,
  currentValue,
  nowMs,
  windowMs,
  fallbackSamples = 10,
}) => {
  const threshold = METRIC_TREND_THRESHOLDS[metricKey] ?? 0.1;
  if (currentValue == null || !Number.isFinite(currentValue)) {
    return { delta: null, direction: "flat", threshold, baseline: null };
  }

  const validSamples = Array.isArray(samples)
    ? samples.filter((sample) => sample && Number.isFinite(sample.timestamp))
    : [];
  const windowStart = nowMs - windowMs;

  const windowBaseline = [...validSamples]
    .reverse()
    .find((sample) => sample.timestamp <= windowStart && Number.isFinite(sample.metrics?.[metricKey]));

  let baseline = windowBaseline?.metrics?.[metricKey] ?? null;

  if (baseline == null) {
    let seen = 0;
    for (let index = validSamples.length - 1; index >= 0; index -= 1) {
      const value = validSamples[index]?.metrics?.[metricKey];
      if (!Number.isFinite(value)) continue;
      seen += 1;
      if (seen >= fallbackSamples + 1) {
        baseline = value;
        break;
      }
    }
  }

  if (baseline == null) {
    for (let index = 0; index < validSamples.length; index += 1) {
      const value = validSamples[index]?.metrics?.[metricKey];
      if (Number.isFinite(value)) {
        baseline = value;
        break;
      }
    }
  }

  if (baseline == null || !Number.isFinite(baseline)) {
    return { delta: null, direction: "flat", threshold, baseline: null };
  }

  const delta = currentValue - baseline;
  return { delta, direction: getTrendDirection(delta, threshold), threshold, baseline };
};

export const buildHealthReasons = ({
  health,
  lastSeenMs,
  nowMs,
  msgRate,
  expectedRate,
  dataQuality,
  payloadError,
}) => {
  const reasons = [];
  const secondsAgo = lastSeenMs ? Math.max(0, Math.round((nowMs - lastSeenMs) / 1000)) : null;

  if (!lastSeenMs) {
    reasons.push("lastSeen: never");
  } else if (["offline", "critical"].includes(health.status) && health.reason !== "nominal") {
    if (health.reason === "offline_threshold" || health.reason === "approaching_offline") {
      reasons.push(`lastSeen stale: ${secondsAgo}s ago`);
    }
  }

  if (expectedRate && Number.isFinite(msgRate) && msgRate < expectedRate) {
    reasons.push(`msgRate low (${msgRate}/min, expected ${expectedRate}/min)`);
  }

  if (health.reason === "zero_rate") {
    reasons.push("msgRate stalled at 0/min");
  }

  const missingMetrics = [
    ...(dataQuality?.missingCritical ?? []),
    ...(dataQuality?.missingOptional ?? []),
  ];
  if (missingMetrics.length > 0) {
    reasons.push(`missing metrics: ${missingMetrics.join(", ")}`);
  }

  if (payloadError) {
    reasons.push("parse errors detected in recent telemetry");
  }

  if (reasons.length === 0) {
    reasons.push("nominal - no health issues detected");
  }

  return reasons;
};

export const evaluateDeviceHealth = ({
  nowMs,
  lastSeenMs,
  msgRate,
  expectedIntervalSec,
  expectedMetrics,
  metrics,
  payloadError,
}) => {
  if (!lastSeenMs) {
    return { status: "offline", reason: "never_seen", dataQuality: computeDataQuality(metrics, expectedMetrics) };
  }

  const secondsAgo = Math.max(0, (nowMs - lastSeenMs) / 1000);
  const offlineThresholdSec = expectedIntervalSec
    ? expectedIntervalSec * 3
    : DEVICE_HEALTH_CONFIG.defaultExpectedIntervalSec * 3;
  if (secondsAgo > Math.max(offlineThresholdSec, 120)) {
    return { status: "offline", reason: "offline_threshold", dataQuality: computeDataQuality(metrics, expectedMetrics) };
  }

  const dataQuality = computeDataQuality(metrics, expectedMetrics);
  const expectedRate = computeExpectedRatePerMinute(expectedIntervalSec);

  if (payloadError) {
    return { status: "critical", reason: "payload_error", dataQuality };
  }

  const twoWindowThreshold = DEVICE_HEALTH_CONFIG.evaluationWindowSec * 2;
  if (msgRate === 0 && secondsAgo >= twoWindowThreshold) {
    return { status: "critical", reason: "zero_rate", dataQuality };
  }

  const approachingOfflineSec = expectedIntervalSec ? Math.min(60, expectedIntervalSec * 2) : 60;
  if (secondsAgo >= approachingOfflineSec && secondsAgo < Math.max(offlineThresholdSec, 120)) {
    return { status: "critical", reason: "approaching_offline", dataQuality };
  }

  if (dataQuality.missingCritical.length > 0) {
    return { status: "critical", reason: "missing_critical", dataQuality };
  }

  if (expectedRate && msgRate < expectedRate * 0.7) {
    return { status: "degraded", reason: "low_rate", dataQuality };
  }

  if (dataQuality.missingOptional.length > 0) {
    return { status: "degraded", reason: "missing_optional", dataQuality };
  }

  return { status: "ok", reason: "nominal", dataQuality };
};

const extractValue = (input) => {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof input === "object") {
    const candidate = input.value ?? input.avg ?? input.average ?? input.v ?? input.reading;
    return extractValue(candidate);
  }
  return null;
};

const addMetric = (metrics, key, value) => {
  if (!key) return;
  if (value == null) return;
  metrics[key] = value;
};

export const extractMetricsFromPayload = (payload = {}) => {
  const metrics = {};
  let spectraCount = 0;

  const ingestEntries = (entries) => {
    if (!entries) return;
    if (Array.isArray(entries)) {
      entries.forEach((entry) => {
        const rawKey = entry?.sensorType ?? entry?.type ?? entry?.name ?? entry?.key;
        const rawValue = entry?.value ?? entry?.avg ?? entry?.average ?? entry?.reading;
        const sanitized = sanitizeKey(rawKey);
        const normalized = METRIC_ALIASES[sanitized] ?? METRIC_ALIASES[sanitizeKey(entry?.sensorName)] ?? null;
        if (normalized) addMetric(metrics, normalized, extractValue(rawValue));
        if (SPECTRAL_MATCHERS.some((matcher) => matcher(rawKey || ""))) spectraCount += 1;
      });
      return;
    }

    if (typeof entries === "object") {
      Object.entries(entries).forEach(([rawKey, rawValue]) => {
        const sanitized = sanitizeKey(rawKey);
        const normalized = METRIC_ALIASES[sanitized] ?? null;
        if (normalized) addMetric(metrics, normalized, extractValue(rawValue));
        if (SPECTRAL_MATCHERS.some((matcher) => matcher(rawKey || ""))) spectraCount += 1;
      });
    }
  };

  ingestEntries(payload.metrics);
  ingestEntries(payload.sensors);
  ingestEntries(payload.readings);
  ingestEntries(payload.environment);
  ingestEntries(payload.telemetry);
  ingestEntries(payload.data);

  if (spectraCount > 0) {
    metrics.spectra = spectraCount;
  }

  return metrics;
};

export const formatMetricValue = (key, value) => {
  if (value == null) return "—";
  const definition = METRIC_DEFINITIONS[key] ?? {};
  const precision = Number.isFinite(definition.precision) ? definition.precision : 1;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const unit = definition.unit ? ` ${definition.unit}` : "";
  return `${numeric.toFixed(precision)}${unit}`;
};

export const getMetricLabel = (key) => METRIC_DEFINITIONS[key]?.label ?? key;
