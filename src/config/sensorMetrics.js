const sanitize = (value) =>
  value == null
    ? ""
    : String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const RAW_DEFINITIONS = [
  {
    id: "temperature",
    overviewLabel: "Temp",
    liveLabel: "Temp",
    typeAliases: ["temperature", "temp", "airtemp", "airtemperature"],
    modelOverrides: [
      { match: "ds18b20", label: "D_Temp" },
      { match: "sht3x", label: "A_Temp" },
      { match: "hdc302x", label: "G_Temp" },
    ],
  },
  {
    id: "humidity",
    overviewLabel: "Humidity",
    liveLabel: "Hum",
    typeAliases: ["humidity", "rh", "relativehumidity"],
    modelOverrides: [
      { match: "sht3x", label: "A_RH" },
      { match: "hdc302x", label: "G_RH" },
    ],
  },
  {
    id: "light",
    overviewLabel: "Light",
    liveLabel: "Light",
    typeAliases: ["light", "lux", "illumination"],
  },
  {
    id: "co2",
    overviewLabel: "CO₂",
    liveLabel: "co2",
    typeAliases: ["co2", "co₂", "co2ppm"],
  },
  {
    id: "ph",
    overviewLabel: "pH",
    liveLabel: "ph",
    typeAliases: ["ph"],
  },
  {
    id: "dissolvedoxygen",
    overviewLabel: "DO",
    liveLabel: "DO",
    typeAliases: ["dissolvedoxygen", "oxygen", "oxygenmgl", "domgl", "do"],
  },
  {
    id: "dissolvedec",
    overviewLabel: "EC",
    liveLabel: "EC",
    typeAliases: ["dissolvedec", "ec", "ecmscm", "electricalconductivity"],
  },
  {
    id: "dissolvedtds",
    overviewLabel: "TDS",
    liveLabel: "TDS",
    typeAliases: ["dissolvedtds", "tds", "tdsppm"],
  },
  {
    id: "dissolvedtemp",
    overviewLabel: "Water Temp",
    liveLabel: "Water Temp",
    typeAliases: ["dissolvedtemp", "watertemp", "water_temp", "watertemperature"],
  },
];

const definitionsById = new Map();
const aliasToId = new Map();

for (const raw of RAW_DEFINITIONS) {
  const id = sanitize(raw.id);
  if (!id) continue;

  const typeAliases = new Set([id]);
  for (const alias of raw.typeAliases || []) {
    const sanitizedAlias = sanitize(alias);
    if (sanitizedAlias) typeAliases.add(sanitizedAlias);
  }

  const modelOverrides = (raw.modelOverrides || [])
    .map((override) => {
      const candidates = Array.isArray(override.match)
        ? override.match
        : [override.match];
      const matchers = candidates
        .map((candidate) => sanitize(candidate))
        .filter(Boolean);
      if (!matchers.length || !override.label) return null;
      return { label: override.label, matchers };
    })
    .filter(Boolean);

  const prepared = {
    id,
    overviewLabel: raw.overviewLabel ?? raw.liveLabel ?? raw.id,
    liveLabel: raw.liveLabel ?? raw.overviewLabel ?? raw.id,
    typeAliases: [...typeAliases],
    modelOverrides,
  };

  definitionsById.set(id, prepared);
  for (const alias of prepared.typeAliases) {
    aliasToId.set(alias, id);
  }
}

function getDefinitionId(input) {
  const sanitized = sanitize(input);
  if (!sanitized) return null;
  return aliasToId.get(sanitized) ?? null;
}

export function getMetricDefinition(input) {
  const id = getDefinitionId(input);
  return id ? definitionsById.get(id) ?? null : null;
}

function resolveModelOverride(definition, sensorModel) {
  if (!definition?.modelOverrides?.length) return null;
  const sanitizedModel = sanitize(sensorModel);
  if (!sanitizedModel) return null;

  for (const override of definition.modelOverrides) {
    for (const matcher of override.matchers) {
      if (sanitizedModel === matcher || sanitizedModel.includes(matcher)) {
        return override.label;
      }
    }
  }
  return null;
}

export function getMetricLiveLabel(measurementType, sensorModel) {
  const definition = getMetricDefinition(measurementType);
  if (!definition) return measurementType;

  const override = resolveModelOverride(definition, sensorModel);
  if (override) return override;

  return definition.liveLabel ?? measurementType;
}

export function getMetricOverviewLabel(metricKey) {
  const definition = getMetricDefinition(metricKey);
  if (!definition) return metricKey;
  return definition.overviewLabel;
}

export const SENSOR_METRIC_IDS = [...definitionsById.keys()];

export default {
  getMetricDefinition,
  getMetricLiveLabel,
  getMetricOverviewLabel,
  SENSOR_METRIC_IDS,
};
