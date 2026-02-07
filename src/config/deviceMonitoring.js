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
        critical: ["airTemp", "rh"],
        optional: ["light", "co2", "spectra"],
      },
    },
    GERMINATION: {
      expectedIntervalSec: 12,
      metrics: {
        critical: ["airTemp", "rh"],
        optional: ["waterTemp", "light"],
      },
    },
    ENV: {
      expectedIntervalSec: 15,
      metrics: {
        critical: ["airTemp", "rh"],
        optional: ["co2"],
      },
    },
  },
};

export const METRIC_DEFINITIONS = {
  airTemp: { label: "Air Temp", unit: "°C", precision: 1 },
  rh: { label: "RH", unit: "%", precision: 1 },
  light: { label: "Light", unit: "lux", precision: 0 },
  co2: { label: "CO₂", unit: "ppm", precision: 0 },
  ph: { label: "pH", unit: "", precision: 1 },
  ec: { label: "EC", unit: "mS/cm", precision: 2 },
  solutionTemp: { label: "Solution Temp", unit: "°C", precision: 1 },
  waterTemp: { label: "Water Temp", unit: "°C", precision: 1 },
  spectra: { label: "Spectra", unit: "bands", precision: 0 },
};

export const DEVICE_KIND_OPTIONS = ["TANK", "LAYER", "ENV", "GERMINATION"];
export const HEALTH_STATUS_ORDER = ["critical", "degraded", "ok", "offline"];
export const MESSAGE_KIND_OPTIONS = ["telemetry", "status", "event"];
