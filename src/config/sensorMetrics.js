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
    typeAliases: ["temperature", "temp", "airtemp", "airtemperature", "A_Temp", "A_Temp_C"],
    contextOverrides: [
      {
        topics: ["/topic/germinationTopic", "germinationTopic"],
        models: ["ds18b20"],
        label: "D_Temp",
      },
    ],
    topicOverrides: [
      { match: ["/topic/growSensors", "growSensors"], label: "A_Temp" },
      { match: ["/topic/germinationTopic", "germinationTopic"], label: "G_Temp" },
      { match: ["/topic/waterTank", "waterTank"], label: "D_Temp" },
    ],
    modelOverrides: [
      { match: "ds18b20", label: "D_Temp" },
      { match: "sht3x", label: "A_Temp" },
      { match: "hdc302x", label: "G_Temp" },
    ],
  },
  {
    id: "humidity",
    overviewLabel: "RH",
    liveLabel: "RH",
    typeAliases: ["humidity", "rh", "relativehumidity", "A_RH", "A_RH_C"],
    topicOverrides: [
      { match: ["/topic/growSensors", "growSensors"], label: "A_RH" },
      { match: ["/topic/germinationTopic", "germinationTopic"], label: "G_RH" },
    ],
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
    topicOverrides: [
      { match: ["/topic/waterTank", "waterTank"], label: "D_Temp" },
      { match: ["/topic/germinationTopic", "germinationTopic"], label: "D_Temp" },
    ],
  },
];

const definitionsById = new Map();
const aliasToId = new Map();

function sanitizeMatchers(values) {
  if (values == null) return [];
  const arr = Array.isArray(values) ? values : [values];
  return arr
    .map((value) => sanitize(value))
    .filter(Boolean);
}

function prepareOverrides(overrides) {
  if (!Array.isArray(overrides)) return [];
  return overrides
    .map((override) => {
      const matchers = sanitizeMatchers(override.match);
      if (!matchers.length || !override.label) return null;
      return { label: override.label, matchers };
    })
    .filter(Boolean);
}

function prepareContextOverrides(overrides) {
  if (!Array.isArray(overrides)) return [];
  return overrides
    .map((override) => {
      if (!override?.label) return null;
      const topicMatchers = sanitizeMatchers(override.topics ?? override.topic);
      const modelMatchers = sanitizeMatchers(override.models ?? override.model);
      if (!topicMatchers.length && !modelMatchers.length) return null;
      return {
        label: override.label,
        topicMatchers,
        modelMatchers,
      };
    })
    .filter(Boolean);
}

for (const raw of RAW_DEFINITIONS) {
  const id = sanitize(raw.id);
  if (!id) continue;

  const typeAliases = new Set([id]);
  for (const alias of raw.typeAliases || []) {
    const sanitizedAlias = sanitize(alias);
    if (sanitizedAlias) typeAliases.add(sanitizedAlias);
  }

  const modelOverrides = prepareOverrides(raw.modelOverrides);
  const topicOverrides = prepareOverrides(raw.topicOverrides);
  const contextOverrides = prepareContextOverrides(raw.contextOverrides);

  const prepared = {
    id,
    overviewLabel: raw.overviewLabel ?? raw.liveLabel ?? raw.id,
    liveLabel: raw.liveLabel ?? raw.overviewLabel ?? raw.id,
    typeAliases: [...typeAliases],
    modelOverrides,
    topicOverrides,
    contextOverrides,
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

function resolveOverride(definition, value, overrides) {
  if (!definition || !Array.isArray(overrides) || !overrides.length) return null;
  const sanitizedValue = sanitize(value);
  if (!sanitizedValue) return null;

  for (const override of overrides) {
    for (const matcher of override.matchers) {
      if (sanitizedValue === matcher || sanitizedValue.endsWith(matcher) || sanitizedValue.includes(matcher)) {
        return override.label;
      }
    }
  }
  return null;
}

function matchesContext(sanitizedValue, matchers) {
  if (!matchers.length) return true;
  if (!sanitizedValue) return false;
  return matchers.some(
    (matcher) =>
      sanitizedValue === matcher ||
      sanitizedValue.endsWith(matcher) ||
      sanitizedValue.includes(matcher),
  );
}

function resolveContextOverride(definition, sensorModel, topic) {
  if (!definition || !Array.isArray(definition.contextOverrides) || !definition.contextOverrides.length) {
    return null;
  }

  const sanitizedModel = sanitize(sensorModel);
  const sanitizedTopic = sanitize(topic);

  for (const override of definition.contextOverrides) {
    if (!matchesContext(sanitizedTopic, override.topicMatchers)) continue;
    if (!matchesContext(sanitizedModel, override.modelMatchers)) continue;
    return override.label;
  }
  return null;
}

function resolveModelOverride(definition, sensorModel) {
  return resolveOverride(definition, sensorModel, definition?.modelOverrides);
}

function resolveTopicOverride(definition, topic) {
  return resolveOverride(definition, topic, definition?.topicOverrides);
}

function parseLiveLabelArgs(sensorModelOrOptions, topicMaybe) {
  if (sensorModelOrOptions && typeof sensorModelOrOptions === "object" && !Array.isArray(sensorModelOrOptions)) {
    return {
      sensorModel: sensorModelOrOptions.sensorModel ?? null,
      topic: sensorModelOrOptions.topic ?? null,
    };
  }
  return {
    sensorModel: sensorModelOrOptions ?? null,
    topic: topicMaybe ?? null,
  };
}

export function getMetricLiveLabel(measurementType, sensorModelOrOptions, topicMaybe) {
  const definition = getMetricDefinition(measurementType);
  if (!definition) return measurementType;

  const { sensorModel, topic } = parseLiveLabelArgs(sensorModelOrOptions, topicMaybe);

  const contextOverride = resolveContextOverride(definition, sensorModel, topic);
  if (contextOverride) return contextOverride;

  const topicOverride = resolveTopicOverride(definition, topic);
  if (topicOverride) return topicOverride;

  const modelOverride = resolveModelOverride(definition, sensorModel);
  if (modelOverride) return modelOverride;

  return definition.liveLabel ?? measurementType;
}

function parseOverviewArgs(optionsOrTopic) {
  if (!optionsOrTopic) return { topic: null };
  if (typeof optionsOrTopic === "object" && !Array.isArray(optionsOrTopic)) {
    return { topic: optionsOrTopic.topic ?? null };
  }
  return { topic: optionsOrTopic };
}

export function getMetricOverviewLabel(metricKey, optionsOrTopic) {
  const definition = getMetricDefinition(metricKey);
  if (!definition) return metricKey;

  const { topic } = parseOverviewArgs(optionsOrTopic);
  const topicOverride = resolveTopicOverride(definition, topic);
  if (topicOverride) return topicOverride;

  return definition.overviewLabel;
}

export const SENSOR_METRIC_IDS = [...definitionsById.keys()];

export default {
  getMetricDefinition,
  getMetricLiveLabel,
  getMetricOverviewLabel,
  SENSOR_METRIC_IDS,
};
