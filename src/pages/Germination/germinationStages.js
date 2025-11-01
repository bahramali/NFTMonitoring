const BASIL_GROWTH_STAGES = [
    {
        id: "seed-germination",
        daysLabel: "1-3",
        minDay: 1,
        maxDay: 3,
        description: "Seed Germination (Pre-Sprout)",
        params: {
            A_Temp_G: { min: 27, max: 30 },
            A_Temp_W: { min: 26, max: 28 },
            A_RH_G: { min: 90, max: 99 },
            light: { min: 0, max: 300 },
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
            A_Temp_G: { min: 25, max: 28 },
            A_Temp_W: { min: 23, max: 25 },
            A_RH_G: { min: 85, max: 90 },
            light: { min: 1000, max: 2500 },
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
            A_Temp_G: { min: 23, max: 25 },
            A_Temp_W: { min: 21, max: 23 },
            A_RH_G: { min: 75, max: 80 },
            light: { min: 4500, max: 6000 },
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
            A_Temp_G: { min: 23, max: 25 },
            A_Temp_W: { min: 21, max: 23 },
            A_RH_G: { min: 70, max: 75 },
            light: { min: 6000, max: 8000 },
            pH: { min: 5.8, max: 6.1 },
            EC: { min: 0.7, max: 0.9 },
        },
    },
];

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
    const { params = {} } = stage;
    if (!params || typeof params !== "object") return null;

    let rawRange = params[metricKey];

    if (!rawRange) {
        const normalizedKey = String(metricKey).toLowerCase();
        const entry = Object.entries(params).find(([key]) => key.toLowerCase() === normalizedKey);
        if (!entry) return null;
        [, rawRange] = entry;
    }

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
