import React from 'react';
import HistoryChart from '../../../components/HistoryChart';
import styles from '../../common/SensorDashboard.module.css';

function ReportCharts({
  rangeData,
  tempRangeData,
  phRangeData,
  ecTdsRangeData,
  doRangeData,
  selectedDevice,
  selectedSensors = {}
}) {
  const withDevice = (title) => (selectedDevice ? `${title}(${selectedDevice})` : title);

  const airq  = new Set(selectedSensors.airq || []);
  const water = new Set(selectedSensors.water || []);
  const light = new Set(selectedSensors.light || []);
  const blue  = new Set(selectedSensors.blue || []);
  const red   = new Set(selectedSensors.red || []);

  const spectrumKeys = Array.from(new Set([...blue, ...red]));

  return (
    <>
      {(airq.has('temperature') || airq.has('humidity')) && (
        <div className={styles.historyChartsRow}>
          {airq.has('temperature') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('Temperature')}</h3>
              <div className={styles.dailyTempChartWrapper}>
                <HistoryChart
                  data={tempRangeData}
                  xDataKey="time"
                  yDataKey="temperature"
                  yLabel="Temperature (°C)"
                />
              </div>
            </div>
          )}
          {airq.has('humidity') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('Humidity')}</h3>
              <div className={styles.dailyTempChartWrapper}>
                <HistoryChart
                  data={tempRangeData}
                  xDataKey="time"
                  yDataKey="humidity"
                  yLabel="Humidity (%)"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {spectrumKeys.length > 0 && (
        <div className={styles.historyChartsRow}>
          {spectrumKeys.map((key) => (
            <div key={key} className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice(key)}</h3>
              <div className={styles.multiBandChartWrapper}>
                <HistoryChart
                  data={rangeData}
                  xDataKey="time"
                  yDataKey={key}
                  yLabel={key}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {light.size > 0 && (
        <div className={styles.historyChartsRow}>
          {light.has('light') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('Lux')}</h3>
              <div className={styles.clearLuxChartWrapper}>
                <HistoryChart
                  data={rangeData}
                  xDataKey="time"
                  yDataKey="lux"
                  yLabel="Lux"
                />
              </div>
            </div>
          )}
          {['VIS1','VIS2','NIR855'].filter((k)=>light.has(k)).map((key)=>(
            <div key={key} className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice(key)}</h3>
              <div className={styles.clearLuxChartWrapper}>
                <HistoryChart
                  data={rangeData}
                  xDataKey="time"
                  yDataKey={key}
                  yLabel={key}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {(water.has('ph') || water.has('dissolvedEC') || water.has('dissolvedTDS') || water.has('dissolvedOxygen')) && (
        <div className={styles.historyChartsRow}>
          {water.has('ph') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('pH')}</h3>
              <div className={styles.phChartWrapper}>
                <HistoryChart
                  data={phRangeData}
                  xDataKey="time"
                  yDataKey="ph"
                  yLabel="pH"
                />
              </div>
            </div>
          )}
          {water.has('dissolvedEC') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('EC')}</h3>
              <div className={styles.ecTdsChartWrapper}>
                <HistoryChart
                  data={ecTdsRangeData}
                  xDataKey="time"
                  yDataKey="ec"
                  yLabel="EC (mS/cm)"
                />
              </div>
            </div>
          )}
          {water.has('dissolvedTDS') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('TDS')}</h3>
              <div className={styles.ecTdsChartWrapper}>
                <HistoryChart
                  data={ecTdsRangeData}
                  xDataKey="time"
                  yDataKey="tds"
                  yLabel="TDS (ppm)"
                />
              </div>
            </div>
          )}
          {water.has('dissolvedOxygen') && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>{withDevice('Dissolved Oxygen')}</h3>
              <div className={styles.doChartWrapper}>
                <HistoryChart
                  data={doRangeData}
                  xDataKey="time"
                  yDataKey="do"
                  yLabel="Dissolved Oxygen (mg/L)"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ReportCharts;
