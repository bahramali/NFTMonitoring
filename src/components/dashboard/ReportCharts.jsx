import React from 'react';
import HistoricalMultiBandChart from '../HistoricalMultiBandChart';
import HistoricalClearLuxChart from '../HistoricalClearLuxChart';
import HistoricalPhChart from '../HistoricalPhChart';
import HistoricalEcTdsChart from '../HistoricalEcTdsChart';
import HistoricalTemperatureChart from '../HistoricalTemperatureChart';
import HistoricalDoChart from '../HistoricalDoChart';
import styles from '../SensorDashboard.module.css';

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
  xDomain
}) {
  return (
    <>
      {showTempHum && (
        <div className={styles.historyChartsRow}>
          <div className={styles.historyChartColumn}>
            <h3 className={styles.sectionTitle}>Temperature</h3>
            <div className={styles.dailyTempChartWrapper}>
              <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain} />
            </div>
          </div>
        </div>
      )}

      {showSpectrum && (
        <div className={styles.historyChartsRow}>
          <div className={styles.historyChartColumn}>
            <h3 className={styles.sectionTitle}>Spectrum</h3>
            <div className={styles.multiBandChartWrapper}>
              <HistoricalMultiBandChart
                data={rangeData}
                xDomain={xDomain}
                bandKeys={['405nm','425nm','450nm','475nm','F4','550nm','555nm','600nm','640nm','690nm','745nm','VIS1','VIS2','NIR855']}
              />
            </div>
          </div>
        </div>
      )}

      {showClearLux && (
        <div className={styles.historyChartsRow}>
          <div className={styles.historyChartColumn}>
            <h3 className={styles.sectionTitle}>Lux_Clear</h3>
            <div className={styles.clearLuxChartWrapper}>
              <HistoricalClearLuxChart data={rangeData} xDomain={xDomain} />
            </div>
          </div>
        </div>
      )}

      {(showPh || showEcTds) && (
        <div className={styles.historyChartsRow}>
          {showPh && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>pH</h3>
              <div className={styles.phChartWrapper}>
                <HistoricalPhChart data={phRangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
          {showEcTds && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>EC &amp; TDS</h3>
              <div className={styles.ecTdsChartWrapper}>
                <HistoricalEcTdsChart data={ecTdsRangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
        </div>
      )}

      {showDo && (
        <div className={styles.historyChartsRow}>
          <div className={styles.historyChartColumn}>
            <h3 className={styles.sectionTitle}>Dissolved Oxygen</h3>
            <div className={styles.doChartWrapper}>
              <HistoricalDoChart data={doRangeData} xDomain={xDomain} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReportCharts;
