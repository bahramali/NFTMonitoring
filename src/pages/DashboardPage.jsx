import React, { useState } from 'react';
import SystemSelect from '../components/dashboard/SystemSelect';
import OverviewList from '../components/dashboard/OverviewList';
import LayersBoard from '../components/dashboard/LayersBoard';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
    const systems = [
        { id: 'sys-a', name: 'System A', metrics: { temp: 25, ph: 6.5 } },
        { id: 'sys-b', name: 'System B', metrics: { temp: 27, ph: 7.0 } },
    ];

    const layers = [
        {
            id: 'layer-1',
            name: 'Layer 1',
            metrics: { moisture: 80 },
            devices: [
                { id: 'd1', name: 'Device 1', metrics: { temp: 24 } },
                { id: 'd2', name: 'Device 2', metrics: { temp: 25 } },
            ],
        },
    ];

    const [selected, setSelected] = useState(systems[0].id);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <SystemSelect systems={systems} value={selected} onChange={setSelected} />
            </div>
            <OverviewList systems={systems} />
            <LayersBoard layers={layers} />
        </div>
    );
}
