import React from 'react';
import HistoryChart from '../../../components/HistoryChart';
import styles from '../../common/SensorDashboard.module.css';

const SPECTRUM_KEYS = ['405nm','425nm','450nm','475nm','F4','550nm','555nm','600nm','640nm','690nm','745nm','VIS1','VIS2','NIR855'];

function ReportCharts({
  showTempHum,
  showSpectrum,
  showClearLux,
  showPh,
  showEcTds,
  showDo,
  rangeData,
  tempRangeData,
  phRangeData,
  ecTdsRangeData,
  doRangeData,
  selectedDevice
}) {
  const withDevice = (title) => (selectedDevice ? `${title}(${selectedDevice})` : title);

  return (
    <>
      {showTempHum && (
        <div className={styles.historyChartsRow}>
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
        </div>
      )}

      {showSpectrum && (
        <div className={styles.historyChartsRow}>
          {SPECTRUM_KEYS.map((key) => (
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

      {showClearLux && (
        <div className={styles.historyChartsRow}>
          <div className={styles.historyChartColumn}>
            <h3 className={styles.sectionTitle}>{withDevice('Clear')}</h3>
            <div className={styles.clearLuxChartWrapper}>
              <HistoryChart
                data={rangeData}
                xDataKey="time"
                yDataKey="clear"
                yLabel="Clear"
              />
            </div>
          </div>
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
        </div>
      )}

      {(showPh || showEcTds) && (
        <div className={styles.historyChartsRow}>
          {showPh && (
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
          {showEcTds && (
            <>
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
            </>
          )}
        </div>
      )}

      {showDo && (
        <div className={styles.historyChartsRow}>
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
        </div>
      )}
    </>
  );
}

export default ReportCharts;
