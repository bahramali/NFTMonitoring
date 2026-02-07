export const DEVICE_HEALTH_CONFIG = {
  defaultExpectedIntervalSec: 10,
  evaluationWindowSec: 60,
  kinds: {
    TANK: {
      expectedIntervalSec: 10,
      metrics: {
        critical: ["ph", "ec"],
        optional: ["solutionTemp"],
      },
    },
    LAYER: {
      expectedIntervalSec: 10,
      metrics: {
        critical: ["airTempC", "rhPct"],
        optional: ["lux", "co2Ppm", "spectraCounts"],
      },
    },
    GERMINATION: {
      expectedIntervalSec: 12,
      metrics: {
        critical: ["airTempC", "rhPct"],
        optional: ["waterTemp", "lux"],
      },
    },
    ENV: {
      expectedIntervalSec: 15,
      metrics: {
        critical: ["airTempC", "rhPct"],
        optional: ["co2Ppm"],
      },
    },
  },
};

export const METRIC_DEFINITIONS = {
  airTempC: { label: "Air Temp", unit: "°C", precision: 2 },
  rhPct: { label: "RH", unit: "%", precision: 2 },
  lux: { label: "Light", unit: "lux", precision: 4 },
  co2Ppm: { label: "CO₂", unit: "ppm", precision: 0 },
  ph: { label: "pH", unit: "", precision: 1 },
  ec: { label: "EC", unit: "mS/cm", precision: 2 },
  solutionTemp: { label: "Solution Temp", unit: "°C", precision: 1 },
  waterTemp: { label: "Water Temp", unit: "°C", precision: 1 },
  spectraCounts: { label: "Spectra", unit: "bands", precision: 0 },
};

export const DEVICE_KIND_OPTIONS = ["TANK", "LAYER", "ENV", "GERMINATION"];
export const HEALTH_STATUS_ORDER = ["critical", "degraded", "ok", "offline"];
export const MESSAGE_KIND_OPTIONS = ["telemetry", "status", "event"];
