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

/**
 * DeviceCard (Sketch style)
 *
 * Props:
 *  id: string
 *  tempC?: number
 *  humidityPct?: number
 *  co2ppm?: number
 *  spectrum?: Record<'405nm'|'425nm'|string, number>
 *  otherLight?: { lux?: number; vis1?: number; vis2?: number; nir855?: number }
 *  water?: { tds_ppm?: number; ec_mScm?: number; tempC?: number; do_mgL?: number }
 */
export default function DeviceCard({
  id,
  tempC,
  humidityPct,
  co2ppm,
  spectrum = {},
  otherLight = {},
  water = null,
}) {
  // Prepare spectrum groups
  const { blue, red, allPairs } = useMemo(() => {
    const arr = Object.entries(spectrum)
      .map(([k, v]) => ({ k, nm: nmToNumber(k), v }))
      .filter((x) => x.nm != null)
      .sort((a, b) => a.nm - b.nm);

    // Blue 400–500nm, Red 550–750nm (covers 550/555nm lines)
    const b = arr.filter((e) => e.nm >= 400 && e.nm <= 500);
    const r = arr.filter((e) => e.nm >= 550 && e.nm <= 750);

    return {
      blue: b.map((e) => `${e.nm}nm: ${fmt(e.v)}`),
      red: r.map((e) => `${e.nm}nm: ${fmt(e.v)}`),
      allPairs: arr.map((e) => [e.k, e.v]),
    };
  }, [spectrum]);

  // Render helpers (compact bracket rows)
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
          <div className={styles.badge}>{id}</div>
        </div>

        {co2ppm != null && line("CO₂", `${fmt(co2ppm)} ppm`)}

        {line("[Temp, Humidity]", `[${fmt(tempC)} °C, ${fmt(humidityPct)} %]`)}

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
