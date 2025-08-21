import React from "react";
import SpectrumBarChart from "../../components/SpectrumBarChart";
import TopicSection from "./TopicSection";
import NotesBlock from "./NotesBlock";
import styles from "./SensorDashboard.module.css";

function Live({
    filteredSystemTopics = {},
    sensorTopicDevices = {},
    selectedDevice = "",
    setSelectedDevice = () => {},
    filteredCompositeIds = [],
    sensorData = {},
    mergedDevices = {},
}) {
    const isArray = Array.isArray(selectedDevice);
    const selectedId = isArray ? selectedDevice[0] || "" : selectedDevice;
    const handleChange = (e) => {
        const val = e.target.value;
        if (isArray) {
            setSelectedDevice([val]);
        } else {
            setSelectedDevice(val);
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionBody}>
                {/* Live tables filtered by Device/Layer/System */}
                <TopicSection systemTopics={filteredSystemTopics} />

                {/* Live spectrum chart for the selected device */}
                {Object.keys(sensorTopicDevices).length > 0 && (
                    <>
                        <div className={styles.chartFilterRow}>
                            <label className={styles.filterLabel}>
                                Composite ID:
                                <select
                                    className={styles.intervalSelect}
                                    value={selectedId}
                                    onChange={handleChange}
                                >
                                    {filteredCompositeIds.map((id) => (
                                        <option key={id} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {isArray && selectedDevice.length > 1 && (
                            <div>Multiple devices selected; showing first.</div>
                        )}

                        <div className={styles.deviceLabel}>{selectedId}</div>

                        {filteredCompositeIds.includes(selectedId) && (
                            <div className={styles.spectrumBarChartWrapper}>
                                <SpectrumBarChart sensorData={sensorData[selectedId]} />
                            </div>
                        )}
                    </>
                )}

                {/* Notes based on mergedDevices */}
                <NotesBlock mergedDevices={mergedDevices} />

            </div>
        </div>
    );
}

export default Live;
