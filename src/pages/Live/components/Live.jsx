import React from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import NotesBlock from "./NotesBlock";
import styles from "./Live.module.css";

function Live({
    sensorTopicDevices = {},
    selectedDevice = "",
    setSelectedDevice = () => {},
    filteredCompositeIds = [],
    sensorData = {},
    mergedDevices = {},
}) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionBody}>
                {/* Live spectrum chart for the selected device */}
                {Object.keys(sensorTopicDevices).length > 0 && (
                    <>
                        <div className={styles.chartFilterRow}>
                            <label className={styles.filterLabel}>
                                Composite ID:
                                <select
                                    className={styles.intervalSelect}
                                    value={selectedDevice}
                                    onChange={(e) => setSelectedDevice(e.target.value)}
                                >
                                    {filteredCompositeIds.map((id) => (
                                        <option key={id} value={id}>{id}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className={styles.deviceLabel}>{selectedDevice}</div>

                        {filteredCompositeIds.includes(selectedDevice) && (
                            <div className={styles.spectrumBarChartWrapper}>
                                <SpectrumBarChart sensorData={sensorData[selectedDevice]}/>
                            </div>
                        )}
                    </>
                )}

                {/* Notes based on mergedDevices */}
                <NotesBlock mergedDevices={mergedDevices}/>

            </div>
        </div>
    );
}

export default Live;
