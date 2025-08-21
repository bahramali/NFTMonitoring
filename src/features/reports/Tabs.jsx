import React, { useState } from 'react';
import ChartsPanel from './ChartsPanel';
import TablePanel from './TablePanel';
import RawPanel from './RawPanel';
import styles from '../dashboard/SensorDashboard.module.css';

function Tabs({ data = [] }) {
  const [active, setActive] = useState('charts');

  let content = null;
  if (active === 'table') content = <TablePanel data={data} />;
  else if (active === 'raw') content = <RawPanel data={data} />;
  else content = <ChartsPanel data={data} />;

  return (
    <div>
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tab} ${active === 'charts' ? styles.activeTab : ''}`}
          onClick={() => setActive('charts')}
        >
          Charts
        </button>
        <button
          type="button"
          className={`${styles.tab} ${active === 'table' ? styles.activeTab : ''}`}
          onClick={() => setActive('table')}
        >
          Table
        </button>
        <button
          type="button"
          className={`${styles.tab} ${active === 'raw' ? styles.activeTab : ''}`}
          onClick={() => setActive('raw')}
        >
          Raw
        </button>
      </div>
      {content}
    </div>
  );
}

export default Tabs;
