const toNum = (v) => (v == null ? null : Number(v));

// Normalize "L01" / "layer1" → "L01"
const normLayerId = (k) => {
    if (/^L\d+$/i.test(k)) return k.toUpperCase();
    const m = /^layer(\d+)$/i.exec(k);
    if (m) return `L${String(m[1]).padStart(2, "0")}`;
    return k;
};

export function normalizeLiveNow(payload) {
    const root = payload?.systems ?? payload;
    if (!root || typeof root !== "object") return [];

    const systems = [];

    const getMetric = (obj, ...keys) => {
        if (!obj) return {avg: null, count: null};
        for (const k of keys) {
            const val =
                obj[k] ?? obj[String(k).toLowerCase()] ?? obj[String(k).toUpperCase()];
            if (val != null) {
                if (typeof val === "object") {
                    return {
                        avg: toNum(val.average ?? val.avg ?? val.value),
                        count: val.deviceCount ?? val.count ?? null,
                    };
                }
                return {avg: toNum(val), count: null};
            }
        }
        return {avg: null, count: null};
    };

    for (const [sysId, sys] of Object.entries(root)) {
        if (!sys || typeof sys !== "object") continue;

        const layerCards = [];
        const layersArr = Array.isArray(sys.layers) ? sys.layers : [];

        for (const layer of layersArr) {
            const id = normLayerId(layer?.id ?? layer?.layerId ?? "");
            const env = layer?.environment ?? {};
            const water = layer?.water ?? {};
            const acts = layer?.actuators ?? {};

            const {avg: lux, count: lightCount} = getMetric(env, "light");
            const {avg: temp, count: tempCount} = getMetric(env, "temperature");
            const {avg: humidity, count: humidityCount} = getMetric(env, "humidity");
            const {avg: co2, count: co2Count} = getMetric(env, "co2", "co₂", "co2ppm");

            const {avg: dTemp, count: dTempCount} = getMetric(water, "dissolvedTemp");
            const {avg: DO, count: DOCount} = getMetric(water, "DO");
            const {avg: pH, count: pHCount} = getMetric(water, "pH", "ph");
            const {avg: EC, count: ECCount} = getMetric(water, "dissolvedEC");
            const {avg: TDS, count: TDSCount} = getMetric(water, "dissolvedTDS");

            const {avg: airPumpAvg, count: airPumpCount} = getMetric(acts, "airpump");
            const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

            const hasAny = [lux, temp, humidity, co2, dTemp, DO, pH, EC, TDS, airPumpAvg].some(
                (v) => v != null
            );
            const missingEnv = [lux, temp, humidity, co2].some((v) => v == null);
            const health = !hasAny ? "down" : missingEnv ? "warn" : "ok";

            layerCards.push({
                id,
                health,
                metrics: {
                    lux: lux ?? null,
                    temp: temp ?? null,
                    humidity: humidity ?? null,
                    co2: co2 ?? null,
                    _counts: {
                        light: lightCount,
                        temperature: tempCount,
                        humidity: humidityCount,
                        co2: co2Count,
                    },
                },
                water: {
                    dissolvedTemp: dTemp ?? null,
                    DO: DO ?? null,
                    pH: pH ?? null,
                    dissolvedEC: EC ?? null,
                    dissolvedTDS: TDS ?? null,
                    _counts: {
                        dissolvedTemp: dTempCount,
                        DO: DOCount,
                        pH: pHCount,
                        dissolvedEC: ECCount,
                        dissolvedTDS: TDSCount,
                    },
                },
                actuators: {
                    airPump,
                    _counts: { airPump: airPumpCount },
                },
            });
        }

        const sysEnv = sys.environment ?? {};
        const {avg: lightAvg, count: lightCount} = getMetric(sysEnv, "light");
        const {avg: humidityAvg, count: humidityCount} = getMetric(sysEnv, "humidity");
        const {avg: tempAvg, count: tempCount} = getMetric(sysEnv, "temperature");
        const {avg: co2Avg, count: co2Count} = getMetric(sysEnv, "co2", "co₂", "co2ppm");

        const sysWater = sys.water ?? {};
        const {avg: dTempAvg, count: dTempCount} = getMetric(
            sysWater,
            "dissolvedTemp"
        );
        const {avg: DOavg, count: DOcount} = getMetric(
            sysWater,
            "DO"
        );
        const {avg: ECavg, count: ECcount} = getMetric(
            sysWater,
            "dissolvedEC"
        );
        const {avg: TDSavg, count: TDScount} = getMetric(
            sysWater,
            "dissolvedTDS"
        );
        const {avg: pHavg, count: pHcount} = getMetric(sysWater, "pH", "ph");

        const sysActs = sys.actuators ?? {};
        const {avg: airPumpAvg, count: airPumpCount} = getMetric(
            sysActs,
            "airPump",
            "airpump"
        );
        const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

        systems.push({
            systemId: sys.systemId ?? sysId,
            status: sys.status ?? "Active",
            devicesOnline: sys.devicesOnline ?? 0,
            devicesTotal: sys.devicesTotal ?? 0,
            sensorsHealthy: sys.sensorsHealthy ?? 0,
            sensorsTotal: sys.sensorsTotal ?? 0,
            lastUpdateMs: toNum(sys.lastUpdate),
            layers: layerCards.map((l) => ({id: l.id, health: l.health})),
            metrics: {
                light: lightAvg ?? null,
                humidity: humidityAvg ?? null,
                temperature: tempAvg ?? null,
                co2: co2Avg ?? null,
                dissolvedTemp: dTempAvg ?? null,
                DO: DOavg ?? null,
                dissolvedEC: ECavg ?? null,
                dissolvedTDS: TDSavg ?? null,
                pH: pHavg ?? null,
                airPump: airPump,
                _counts: {
                    light: lightCount,
                    humidity: humidityCount,
                    temperature: tempCount,
                    co2: co2Count,
                    dissolvedTemp: dTempCount,
                    DO: DOcount,
                    dissolvedEC: ECcount,
                    dissolvedTDS: TDScount,
                    pH: pHcount,
                    airPump: airPumpCount,
                },
            },
            _layerCards: layerCards,
        });
    }

    systems.sort((a, b) => String(a.systemId).localeCompare(String(b.systemId)));
    return systems;
}

