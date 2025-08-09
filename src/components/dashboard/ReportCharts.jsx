import React from 'react';
import HistoricalBlueBandChart from '../HistoricalBlueBandChart';
import HistoricalRedBandChart from '../HistoricalRedBandChart';
import HistoricalClearLuxChart from '../HistoricalClearLuxChart';
import HistoricalPhChart from '../HistoricalPhChart';
import HistoricalEcTdsChart from '../HistoricalEcTdsChart';
import HistoricalTemperatureChart from '../HistoricalTemperatureChart';
import HistoricalDoChart from '../HistoricalDoChart';
import styles from '../SensorDashboard.module.css';

function ReportCharts({
  showTempHum,
  showBlue,
  showRed,
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
      {(showTempHum || showBlue) && (
        <div className={styles.historyChartsRow}>
          {showTempHum && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>Temperature</h3>
              <div className={styles.dailyTempChartWrapper}>
                <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
          {showBlue && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>Blue Bands</h3>
              <div className={styles.blueBandChartWrapper}>
                <HistoricalBlueBandChart data={rangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
        </div>
      )}

      {(showRed || showClearLux) && (
        <div className={styles.historyChartsRow}>
          {showRed && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>Red Bands</h3>
              <div className={styles.redBandChartWrapper}>
                <HistoricalRedBandChart data={rangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
          {showClearLux && (
            <div className={styles.historyChartColumn}>
              <h3 className={styles.sectionTitle}>Lux_Clear</h3>
              <div className={styles.clearLuxChartWrapper}>
                <HistoricalClearLuxChart data={rangeData} xDomain={xDomain} />
              </div>
            </div>
          )}
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
