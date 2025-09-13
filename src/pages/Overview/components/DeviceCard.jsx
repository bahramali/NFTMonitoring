// src/pages/Overview/components/DeviceCard.jsx
import React, { useMemo } from "react";
import styles from "./DeviceCard.module.css";
import { deriveFromSensors } from "../../../utils/normalizeSensors.js";

/* helpers */
const nmToNumber = (key) => {
  const m = /^(\d{3})nm$/i.exec(key || "");
  return m ? Number(m[1]) : null;
};
const fmt = (v) =>
  v == null || Number.isNaN(v)
    ? "--"
    : Number(v) % 1 === 0
    ? String(Number(v))
    : Number(v).toFixed(1);


/**
 * Props:
 *  id?, compositeId?, sensors[]
 *  tempC?, humidityPct?, co2ppm?, spectrum?, otherLight?, water?
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
  const derived = useMemo(() => deriveFromSensors(sensors), [sensors]);

  const name = id || compositeId || "—";

  const t = tempC ?? derived.map.temp;
  const h = humidityPct ?? derived.map.humidity;
  const co2 = co2ppm ?? derived.map.co2;
  const tValid = t != null && !Number.isNaN(t);
  const hValid = h != null && !Number.isNaN(h);
  const co2Valid = co2 != null && !Number.isNaN(co2);

  const spectrumFinal = Object.keys(spectrum).length ? spectrum : (derived.spectrum || {});
  const otherFinal = Object.keys(otherLight).length ? otherLight : (derived.otherLight || {});
  const waterFinal = water || derived.water;
  const clampList = (arr, max = 8) => (arr.length > max ? [...arr.slice(0, max), "…"] : arr);

  const { blueArr, redArr } = useMemo(() => {
    if (!spectrumFinal) return { blueArr: [], redArr: [] };
    const entries = Object.entries(spectrumFinal)
      .map(([k, v]) => ({ nm: nmToNumber(k), val: v }))
      .filter((x) => x.nm != null)
      .sort((a, b) => a.nm - b.nm);

    const blue = entries.filter((e) => e.nm >= 400 && e.nm <= 500)
      .map((e) => `${e.nm}nm: ${fmt(e.val)}`);
    const red = entries.filter((e) => e.nm >= 550 && e.nm <= 750)
      .map((e) => `${e.nm}nm: ${fmt(e.val)}`);

    return { blueArr: blue, redArr: red };
  }, [spectrumFinal]);

  const line = (label, value) => (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.eq}>=</span>
      <span className={styles.vals}>{value}</span>
    </div>
  );

  const renderOtherLight = () => {
    const bits = [];
    if (otherFinal?.lux != null) bits.push(`Lux: ${fmt(otherFinal.lux)}`);
    if (otherFinal?.vis1 != null) bits.push(`VIS1: ${fmt(otherFinal.vis1)}`);
    if (otherFinal?.vis2 != null) bits.push(`VIS2: ${fmt(otherFinal.vis2)}`);
    if (otherFinal?.nir855 != null) bits.push(`NIR855: ${fmt(otherFinal.nir855)}`);
    return bits.length ? line("Other light", `[${bits.join(", ")}]`) : null;
  };

  const renderWater = () => {
    if (!waterFinal) return null;
    const bits = [];
    if (waterFinal.tds_ppm != null) bits.push(`TDS: ${fmt(waterFinal.tds_ppm)} ppm`);
    if (waterFinal.ec_mScm != null) bits.push(`EC: ${fmt(waterFinal.ec_mScm)} mS/cm`);
    if (waterFinal.tempC != null) bits.push(`Temp: ${fmt(waterFinal.tempC)} °C`);
    if (waterFinal.do_mgL != null) bits.push(`DO: ${fmt(waterFinal.do_mgL)} mg/L`);
    return bits.length ? line("Water", `[${bits.join(", ")}]`) : null;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>{name}</div>
        </div>

        {co2Valid && line("CO₂", `${fmt(co2)} ppm`)}

        {(tValid || hValid) &&
          line("[Temp, Humidity]", `[${fmt(t)} °C, ${fmt(h)} %]`)}

        {blueArr.length > 0 && line("Blue light", `[${clampList(blueArr).join(", ")}]`)}
        {redArr.length  > 0 && line("Red light",  `[${clampList(redArr).join(", ")}]`)}

        {renderOtherLight()}
        {renderWater()}
      </div>
    </div>
  );
}
