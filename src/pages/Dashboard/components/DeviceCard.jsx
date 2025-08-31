import React, { useMemo } from "react";
import styles from "./DeviceCard.module.css";

/* -------- Helpers (English comments) -------- */
const nmToNumber = (key) => {
  const m = /^(\d+)nm$/i.exec(key || "");
  return m ? Number(m[1]) : null;
};

const fmt = (v) => {
  if (v == null || Number.isNaN(v)) return "--";
  return Number.isInteger(v) ? String(v) : Number(v).toFixed(1);
};

// normalize sensors array to object
const normSensors = (arr = []) => {
  const out = {};
  for (const s of arr) {
    const key = String(s?.sensorType || s?.type || s?.name || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!key) continue;
    out[key] = { value: s?.value, unit: s?.unit || "" };
  }
  return out;
};

/**
 * DeviceCard (Sketch style)
 *
 * Props:
 *  id?: string
 *  compositeId?: string
 *  sensors?: Array<{ sensorType: string, value: number|string, unit?: string }>
 *  tempC?, humidityPct?, co2ppm?
 *  spectrum?, otherLight?, water?
 */
export default function DeviceCard({
  id,
  compositeId,
  sensors = [],
  tempC,
  humidityPct,
  co2ppm,
  spectrum = {},
  otherLight = {},
  water = null,
}) {
  const sens = useMemo(() => normSensors(sensors), [sensors]);

  const name = id || compositeId || "—";

  const t = tempC ?? sens.temperature?.value ?? sens.temp?.value;
  const h = humidityPct ?? sens.humidity?.value ?? sens.hum?.value;
  const co2 = co2ppm ?? sens.co2?.value;

  const { blue, red } = useMemo(() => {
    const arr = Object.entries(spectrum)
      .map(([k, v]) => ({ k, nm: nmToNumber(k), v }))
      .filter((x) => x.nm != null)
      .sort((a, b) => a.nm - b.nm);

    const b = arr.filter((e) => e.nm >= 400 && e.nm <= 500);
    const r = arr.filter((e) => e.nm >= 550 && e.nm <= 750);

    return {
      blue: b.map((e) => `${e.nm}nm: ${fmt(e.v)}`),
      red: r.map((e) => `${e.nm}nm: ${fmt(e.v)}`),
    };
  }, [spectrum]);

  const line = (label, value) => (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {" = "}
      <span className={styles.vals}>{value}</span>
    </div>
  );

  const renderOtherLight = () => {
    const bits = [];
    if (otherLight.lux != null) bits.push(`Lux: ${fmt(otherLight.lux)}`);
    if (otherLight.vis1 != null) bits.push(`VIS1: ${fmt(otherLight.vis1)}`);
    if (otherLight.vis2 != null) bits.push(`VIS2: ${fmt(otherLight.vis2)}`);
    if (otherLight.nir855 != null) bits.push(`NIR855: ${fmt(otherLight.nir855)}`);
    if (!bits.length) return null;
    return line("Other light", `[${bits.join(", ")}]`);
  };

  const renderWater = () => {
    if (!water) return null;
    const bits = [];
    if (water.tds_ppm != null) bits.push(`TDS: ${fmt(water.tds_ppm)} ppm`);
    if (water.ec_mScm != null) bits.push(`EC: ${fmt(water.ec_mScm)} mS/cm`);
    if (water.tempC != null) bits.push(`Temp: ${fmt(water.tempC)} °C`);
    if (water.do_mgL != null) bits.push(`DO: ${fmt(water.do_mgL)} mg/L`);
    if (!bits.length) return null;
    return line("Water", `[${bits.join(", ")}]`);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>{name}</div>
        </div>

        {co2 != null && line("CO₂", `${fmt(co2)} ppm`)}

        {line("[Temp, Humidity]", `[${fmt(t)} °C, ${fmt(h)} %]`)}

        {blue.length > 0 &&
          line("Blue light", `[${blue.join(", ")}]`)}

        {red.length > 0 &&
          line("Red light", `[${red.join(", ")}]`)}

        {renderOtherLight()}
        {renderWater()}
      </div>
    </div>
  );
}
