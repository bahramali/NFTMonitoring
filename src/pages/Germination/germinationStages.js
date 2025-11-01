const BASIL_GROWTH_STAGES = [
    {
        id: "seed-germination",
        daysLabel: "1-3",
        minDay: 1,
        maxDay: 3,
        description: "Seed Germination (Pre-Sprout)",
        params: {
            AirTemp: { min: 27, max: 30 },
            WaterTemp: { min: 26, max: 28 },
            Humidity: { min: 90, max: 99 },
            Light: { min: 0, max: 300 },
            pH: { min: 5.8, max: 6.0 },
            EC: { min: 0.0, max: 0.3 },
        },
    },
    {
        id: "sprouting",
        daysLabel: "4-6",
        minDay: 4,
        maxDay: 6,
        description: "Sprouting & Cotyledon Expansion",
        params: {
            AirTemp: { min: 25, max: 28 },
            WaterTemp: { min: 23, max: 25 },
            Humidity: { min: 85, max: 90 },
            Light: { min: 1000, max: 2500 },
            pH: { min: 5.8, max: 6.0 },
            EC: { min: 0.3, max: 0.5 },
        },
    },
    {
        id: "early-root",
        daysLabel: "7-9",
        minDay: 7,
        maxDay: 9,
        description: "Early Root Development",
        params: {
            AirTemp: { min: 23, max: 25 },
            WaterTemp: { min: 21, max: 23 },
            Humidity: { min: 75, max: 80 },
            Light: { min: 4500, max: 6000 },
            pH: { min: 5.8, max: 6.0 },
            EC: { min: 0.5, max: 0.7 },
        },
    },
    {
        id: "pre-transplant",
        daysLabel: "10-14",
        minDay: 10,
        maxDay: 14,
        description: "Pre-Transplant Root Strengthening",
        params: {
            AirTemp: { min: 23, max: 25 },
            WaterTemp: { min: 21, max: 23 },
            Humidity: { min: 70, max: 75 },
            Light: { min: 6000, max: 8000 },
            pH: { min: 5.8, max: 6.1 },
            EC: { min: 0.7, max: 0.9 },
        },
    },
];

const sanitize = (value) =>
    String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const DIRECT_STAGE_PARAM_MAP = {
    airtemp: "AirTemp",
    airtemperature: "AirTemp",
    ambienttemperature: "AirTemp",
    temperature: "AirTemp",
    watertemp: "WaterTemp",
    watertemperature: "WaterTemp",
    solutiontemperature: "WaterTemp",
    humidity: "Humidity",
    relativehumidity: "Humidity",
    rh: "Humidity",
    light: "Light",
    lighting: "Light",
    lux: "Light",
    illuminance: "Light",
    illumination: "Light",
    ph: "pH",
    acidity: "pH",
    ec: "EC",
    conductivity: "EC",
    electricalconductivity: "EC",
};

function resolveStageParamKey(metricKey) {
    const sanitized = sanitize(metricKey);
    if (!sanitized) return "";
    if (DIRECT_STAGE_PARAM_MAP[sanitized]) {
        return DIRECT_STAGE_PARAM_MAP[sanitized];
    }

    if (sanitized.includes("water") || sanitized.includes("solution") || sanitized.includes("nutrient")) {
        return "WaterTemp";
    }
    if (sanitized.includes("air")) {
        return "AirTemp";
    }
    if (sanitized.includes("humidity")) {
        return "Humidity";
    }
    if (sanitized.includes("light") || sanitized.includes("lux")) {
        return "Light";
    }
    if (sanitized.includes("ph")) {
        return "pH";
    }
    if (sanitized.includes("conduct")) {
        return "EC";
    }
    return "";
}

export function getGerminationStageByDay(dayNumber) {
    if (!Number.isFinite(dayNumber) || dayNumber < 1) {
        return null;
    }

    const direct = BASIL_GROWTH_STAGES.find(
        (stage) => dayNumber >= stage.minDay && dayNumber <= stage.maxDay,
    );

    if (direct) {
        return { ...direct, isBeyondDefinedRange: false };
    }

    const fallback = BASIL_GROWTH_STAGES[BASIL_GROWTH_STAGES.length - 1];
    if (!fallback) return null;

    return { ...fallback, isBeyondDefinedRange: dayNumber > fallback.maxDay };
}

export function getStageRangeForMetric(metricKey, stage) {
    if (!stage || !metricKey) return null;
    const resolvedKey = resolveStageParamKey(metricKey);
    if (!resolvedKey) return null;
    const rawRange = stage.params?.[resolvedKey];
    if (!rawRange) return null;
    const { min, max } = rawRange;
    const hasMin = typeof min === "number" && Number.isFinite(min);
    const hasMax = typeof max === "number" && Number.isFinite(max);
    if (!hasMin && !hasMax) return null;
    return {
        min: hasMin ? min : undefined,
        max: hasMax ? max : undefined,
        sourceKey: stage.id,
        stageDescription: stage.description,
        stageDaysLabel: stage.daysLabel,
        stageBeyondDefinedRange: Boolean(stage.isBeyondDefinedRange),
    };
}

export { BASIL_GROWTH_STAGES };
