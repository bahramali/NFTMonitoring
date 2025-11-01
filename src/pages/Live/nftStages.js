function sanitize(value) {
    if (value === undefined || value === null) return "";
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const PARAM_ALIAS_OVERRIDES = {
    AirTemp: "airTemp",
    WaterTemp: "waterTemp",
    Humidity: "humidity",
    Light: "light",
    pH: "ph",
    EC: "ec",
    A_Temp_C: "airTemp",
    A_RH_C: "humidity",
    co2: "co2",
};

const ALIAS_GROUPS = {
    airtemp: ["airtemp", "atemp", "atempc", "a_temp", "a_temp_c", "atempg", "airtemperature", "temperature"],
    watertemp: [
        "watertemp",
        "watertempc",
        "dtemp",
        "d_temp",
        "dissolvedtemp",
        "dissolvedtemperature",
        "water_temp",
        "water_temp_c",
        "watertemperature"
    ],
    humidity: ["humidity", "relativehumidity", "a_rh", "arh", "arhc", "a_rh_c", "rh"],
    light: ["light", "lux", "ppfd"],
    ph: ["ph"],
    ec: ["ec", "dissolvedec", "electricalconductivity"],
    co2: ["co2", "co2ppm"],
};

const NFT_SOLUTION_STAGES = [
    {
        id: "post-transplant",
        daysLabel: "15-21",
        minDay: 15,
        maxDay: 21,
        description: "Post-Transplant – Early Vegetative (NFT channels)",
        params: {
            AirTemp: { min: 23, max: 26, unit: "°C" },
            WaterTemp: { min: 20, max: 22, unit: "°C" },
            Humidity: { min: 65, max: 70, unit: "%" },
            Light: { min: 8000, max: 12000, unit: "lux" },
            pH: { min: 5.8, max: 6.1 },
            EC: { min: 1.0, max: 1.2, unit: "mS/cm" },
        },
    },
    {
        id: "vegetative-growth",
        daysLabel: "22-35",
        minDay: 22,
        maxDay: 35,
        description: "Vegetative Growth – Leaf Development",
        params: {
            AirTemp: { min: 22, max: 25, unit: "°C" },
            WaterTemp: { min: 20, max: 22, unit: "°C" },
            Humidity: { min: 60, max: 65, unit: "%" },
            Light: { min: 12000, max: 15000, unit: "lux" },
            pH: { min: 5.8, max: 6.2 },
            EC: { min: 1.2, max: 1.6, unit: "mS/cm" },
        },
    },
    {
        id: "mature-vegetative",
        daysLabel: "36-50",
        minDay: 36,
        maxDay: 50,
        description: "Mature Vegetative – Pre-Harvest",
        params: {
            AirTemp: { min: 22, max: 25, unit: "°C" },
            WaterTemp: { min: 19, max: 21, unit: "°C" },
            Humidity: { min: 55, max: 60, unit: "%" },
            Light: { min: 15000, max: 18000, unit: "lux" },
            pH: { min: 5.8, max: 6.2 },
            EC: { min: 1.4, max: 1.8, unit: "mS/cm" },
        },
    },
    {
        id: "harvest-regrowth",
        daysLabel: "51-60",
        minDay: 51,
        maxDay: 60,
        description: "Harvest & Regrowth Cycle",
        params: {
            AirTemp: { min: 22, max: 25, unit: "°C" },
            WaterTemp: { min: 19, max: 21, unit: "°C" },
            Humidity: { min: 55, max: 60, unit: "%" },
            Light: { min: 15000, max: 18000, unit: "lux" },
            pH: { min: 5.8, max: 6.2 },
            EC: { min: 1.4, max: 1.6, unit: "mS/cm" },
        },
    },
];

const GROW_SENSOR_STAGES = [
    {
        id: "early-vegetative",
        daysLabel: "1-10",
        minDay: 1,
        maxDay: 10,
        description: "Early Vegetative (Post-Transplant, Root Establishment)",
        params: {
            A_Temp_C: { min: 23, max: 26, unit: "°C" },
            A_RH_C: { min: 65, max: 72, unit: "%" },
            light: { min: 8000, max: 12000, unit: "lux" },
            co2: { min: 600, max: 900, unit: "ppm" },
        },
        spectral: {
            control: "monitor",
            target_fullscale: { minPct: 60, maxPct: 80 },
            note: "Keep VIS1/FD1 ~60–80% FS; avoid saturation (>95%).",
        },
    },
    {
        id: "main-vegetative",
        daysLabel: "11-30",
        minDay: 11,
        maxDay: 30,
        description: "Main Vegetative Growth – Leaf Expansion",
        params: {
            A_Temp_C: { min: 22, max: 25, unit: "°C" },
            A_RH_C: { min: 58, max: 65, unit: "%" },
            light: { min: 12000, max: 16000, unit: "lux" },
            co2: { min: 700, max: 1200, unit: "ppm" },
        },
        spectral: {
            control: "monitor",
            target_fullscale: { minPct: 55, maxPct: 75 },
            note: "Maintain stable spectrum; lower gain if VIS1 >85% FS.",
        },
    },
    {
        id: "mature-vegetative-harvest",
        daysLabel: "31-46",
        minDay: 31,
        maxDay: 46,
        description: "Mature Vegetative – Harvest & Regrowth",
        params: {
            A_Temp_C: { min: 22, max: 25, unit: "°C" },
            A_RH_C: { min: 55, max: 60, unit: "%" },
            light: { min: 15000, max: 18000, unit: "lux" },
            co2: { min: 800, max: 1200, unit: "ppm" },
        },
        spectral: {
            control: "monitor",
            target_fullscale: { minPct: 50, maxPct: 70 },
            note: "Use same range after harvest to support regrowth.",
        },
    },
];

function toNumber(value) {
    if (value === undefined || value === null || value === "") return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

function normalizeRange(range) {
    if (!range) return null;
    const min = toNumber(range.min);
    const max = toNumber(range.max);
    if (min === undefined && max === undefined) return null;
    return {
        min,
        max,
        unit: range.unit || undefined,
    };
}

function formatLabel(key) {
    if (!key) return "";
    return key
        .replace(/[_-]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeStage(stage, options = {}) {
    const { groupId } = options;
    const entries = [];
    const params = stage?.params && typeof stage.params === "object" ? stage.params : {};
    for (const [key, rawRange] of Object.entries(params)) {
        const canonical = PARAM_ALIAS_OVERRIDES[key] || key;
        const sanitizedKey = sanitize(canonical);
        const normalized = normalizeRange(rawRange);
        if (!sanitizedKey || !normalized) continue;
        const aliases = new Set([sanitizedKey]);
        const aliasGroup = ALIAS_GROUPS[sanitizedKey];
        if (Array.isArray(aliasGroup)) {
            for (const alias of aliasGroup) {
                const sanitized = sanitize(alias);
                if (sanitized) aliases.add(sanitized);
            }
        }
        entries.push({
            key,
            sanitizedKey,
            aliases: [...aliases],
            displayLabel: rawRange?.label || formatLabel(key),
            range: normalized,
            groupId,
        });
    }

    return {
        ...stage,
        entries,
    };
}

function pickStage(stages, dayNumber) {
    if (!Array.isArray(stages) || !stages.length) return null;
    const safeDay = Number.isFinite(dayNumber) ? Math.max(1, Math.floor(dayNumber)) : 1;
    const direct = stages.find((stage) => {
        if (stage.minDay !== undefined && safeDay < stage.minDay) return false;
        if (stage.maxDay !== undefined && safeDay > stage.maxDay) return false;
        return true;
    });

    if (direct) {
        return { ...direct, isBeforeDefinedRange: false, isBeyondDefinedRange: false };
    }

    const sorted = [...stages].sort((a, b) => (a.minDay ?? 0) - (b.minDay ?? 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (safeDay < (first?.minDay ?? 1)) {
        return { ...first, isBeforeDefinedRange: true, isBeyondDefinedRange: false };
    }

    return { ...last, isBeforeDefinedRange: false, isBeyondDefinedRange: safeDay > (last?.maxDay ?? safeDay) };
}

const SOLUTION_GROUP = {
    id: "solution",
    label: "NFT Solution Channels",
    topics: ["wateroutput", "watertank", "actuatoroxygenpump"],
    stages: NFT_SOLUTION_STAGES.map((stage) => normalizeStage(stage, { groupId: "solution" })),
};

const ENVIRONMENT_GROUP = {
    id: "environment",
    label: "Grow Sensors",
    topics: ["growsensors"],
    stages: GROW_SENSOR_STAGES.map((stage) => normalizeStage(stage, { groupId: "environment" })),
};

const STAGE_GROUPS = [SOLUTION_GROUP, ENVIRONMENT_GROUP];

export function getNftStageContext(dayNumber) {
    const byTopic = new Map();
    const global = new Map();
    const summaries = [];
    const extraNotes = [];

    for (const group of STAGE_GROUPS) {
        const stage = pickStage(group.stages, dayNumber);
        if (!stage) continue;

        const summary = {
            groupId: group.id,
            groupLabel: group.label,
            description: stage.description,
            daysLabel: stage.daysLabel || "",
            isBeforeRange: Boolean(stage.isBeforeDefinedRange),
            isBeyondRange: Boolean(stage.isBeyondDefinedRange),
            metrics: stage.entries.map((entry) => ({
                label: entry.displayLabel,
                range: entry.range,
            })),
        };

        if (group.id === "environment" && stage.spectral) {
            const { control, target_fullscale, note } = stage.spectral;
            const pieces = [];
            if (control) pieces.push(`Spectral control: ${control}`);
            if (target_fullscale) {
                const minPct = toNumber(target_fullscale.minPct);
                const maxPct = toNumber(target_fullscale.maxPct);
                if (minPct !== undefined || maxPct !== undefined) {
                    pieces.push(
                        `Target VIS1/FD1: ${minPct ?? "?"}–${maxPct ?? "?"}% full-scale`
                    );
                }
            }
            if (note) pieces.push(note);
            if (pieces.length) {
                summary.notes = pieces;
                extraNotes.push(...pieces);
            }
        }

        summaries.push(summary);

        const topics = Array.isArray(group.topics) && group.topics.length ? group.topics : null;
        for (const entry of stage.entries) {
            for (const alias of entry.aliases) {
                const payload = {
                    ...entry.range,
                    stageDescription: stage.description,
                    stageDaysLabel: stage.daysLabel,
                    stageGroupId: group.id,
                    stageGroupLabel: group.label,
                    stageBeyondDefinedRange: Boolean(stage.isBeyondDefinedRange),
                    stageBeforeDefinedRange: Boolean(stage.isBeforeDefinedRange),
                };
                if (topics) {
                    for (const topic of topics) {
                        const topicKey = sanitize(topic);
                        if (!topicKey) continue;
                        const topicMap = byTopic.get(topicKey) ?? new Map();
                        topicMap.set(alias, payload);
                        byTopic.set(topicKey, topicMap);
                    }
                } else {
                    global.set(alias, payload);
                }
            }
        }
    }

    return {
        rangeLookup: { byTopic, global },
        summaries,
        notes: extraNotes,
    };
}

export const nftStageGroups = STAGE_GROUPS;
