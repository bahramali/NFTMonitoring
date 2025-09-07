import React from "react";
import HistoryChart from "../../../components/HistoryChart";
import spectralColors from "../../../spectralColors";
import styles from "./ReportCharts.module.css";

// English comments: helper to convert {cid: data[]} to multi-series spec
const toSeries = (byCid, yKey) =>
    Object.entries(byCid || {}).map(([cid, data]) => ({
        name: cid,
        data,
        yDataKey: yKey,
    }));

// English comments: build series for multiple spectrum keys across CIDs
const toSpectrumSeries = (byCid, keys = []) =>
    Object.entries(byCid || {}).flatMap(([cid, data]) =>
        keys.map((k) => ({ name: `${cid} ${k}`, data, yDataKey: k, color: spectralColors[k] || undefined }))
    );

const withDevice = (title, selectedDevice) =>
    selectedDevice ? `${title} (${selectedDevice})` : title;


export default function ReportCharts({
                                         tempByCid,
                                         rangeByCid,
                                         phByCid,
                                         ecTdsByCid,
                                         doByCid,
                                         selectedSensors = {},
                                         xDomain,
                                         selectedDevice
                                     }) {
    const airq = new Set(selectedSensors.airq || []);
    const water = new Set(selectedSensors.water || []);
    const light = new Set(selectedSensors.light || []);
    const blue = new Set(selectedSensors.blue || []);
    const red = new Set(selectedSensors.red || []);

    return (
        <>
            {(airq.has("temperature") || airq.has("humidity")) && (
                <div className={styles.historyChartsRow}>
                    {airq.has("temperature") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                    {withDevice("Temperature", selectedDevice)}
                            </h3>
                            <div className={styles.dailyTempChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(tempByCid, "temperature")}
                                    yLabel="Temperature (°C)"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                    {airq.has("humidity") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("Humidity", selectedDevice)}
                            </h3>
                            <div className={styles.dailyTempChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(tempByCid, "humidity")}
                                    yLabel="Humidity (%)"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(blue.size > 0 || red.size > 0) && (
                <div className={styles.historyChartsRow}>
                    {blue.size > 0 && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("Blue Spectrum", selectedDevice)}
                            </h3>
                            <div className={styles.multiBandChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSpectrumSeries(rangeByCid, Array.from(blue))}
                                    yLabel="Intensity"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                    {red.size > 0 && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("Red Spectrum", selectedDevice)}
                            </h3>
                            <div className={styles.multiBandChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSpectrumSeries(rangeByCid, Array.from(red))}
                                    yLabel="Intensity"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {light.size > 0 && light.has("light") && (
                <div className={styles.historyChartsRow}>
                    <div className={styles.historyChartColumn}>
                        <h3 className={styles.sectionTitle}>
                            {withDevice("Lux", selectedDevice)}
                        </h3>
                        <div className={styles.clearLuxChartWrapper}>
                            <HistoryChart
                                xDataKey="time"
                                series={toSeries(rangeByCid, "lux")}
                                yLabel="Lux"
                                xDomain={xDomain}
                            />
                        </div>
                    </div>
                </div>
            )}

            {(water.has("ph") || water.has("dissolvedEC") || water.has("dissolvedTDS") || water.has("dissolvedOxygen")) && (
                <div className={styles.historyChartsRow}>
                    {water.has("ph") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("pH", selectedDevice)}
                            </h3>
                            <div className={styles.phChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(phByCid, "ph")}
                                    yLabel="pH"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                    {water.has("dissolvedEC") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("EC", selectedDevice)}
                            </h3>
                            <div className={styles.ecTdsChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(ecTdsByCid, "ec")}
                                    yLabel="EC (mS/cm)"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                    {water.has("dissolvedTDS") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("TDS", selectedDevice)}
                            </h3>
                            <div className={styles.ecTdsChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(ecTdsByCid, "tds")}
                                    yLabel="TDS (ppm)"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                    {water.has("dissolvedOxygen") && (
                        <div className={styles.historyChartColumn}>
                            <h3 className={styles.sectionTitle}>
                                {withDevice("Dissolved Oxygen", selectedDevice)}
                            </h3>
                            <div className={styles.doChartWrapper}>
                                <HistoryChart
                                    xDataKey="time"
                                    series={toSeries(doByCid, "do")}
                                    yLabel="Dissolved Oxygen (mg/L)"
                                    xDomain={xDomain}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
