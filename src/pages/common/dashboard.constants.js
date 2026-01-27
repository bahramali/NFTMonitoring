import { HYDROLEAF_TOPICS } from "../../utils/telemetryAdapter.js";

export const SENSOR_TOPIC = "hydroleaf/telemetry";
export const LIVE_NOW_TOPIC = "live_now";
export const GERMINATION_TOPIC = "germinationTopic";
export const WATER_FLOW_TOPIC = "water_flow";
// Topic list used for device-level streams; excludes aggregated `live_now` data
export const topics = HYDROLEAF_TOPICS;

export const bandMap = {
  F1: "415nm",
  F2: "445nm",
  F3: "480nm",
  F4: "515nm",
  F5: "555nm",
  F6: "590nm",
  F7: "630nm",
  F8: "680nm"
};

export const knownFields = new Set([
  "temperature",
  "humidity",
  "lux",
  "tds",
  "ec",
  "ph",
  "do",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "clear",
  "nir"
]);
