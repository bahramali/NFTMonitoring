import React from 'react';
import DeviceTable from '../DeviceTable';
import styles from '../SensorDashboard.module.css';

function TopicSection({ systemTopics = {} }) {
  return (
    <>
      {Object.entries(systemTopics).map(([topic, devices]) => (
        <div key={topic} className={styles.deviceGroup}>
          <h3 className={styles.topicTitle}>{topic}</h3>
          <DeviceTable devices={devices} />
        </div>
      ))}
    </>
  );
}

export default TopicSection;
