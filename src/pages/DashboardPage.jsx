import React, { useEffect, useState } from 'react';
import OverviewList from '../components/dashboard/OverviewList';
import LayersBoard from '../components/dashboard/LayersBoard';
import styles from './DashboardPage.module.css';
import { useLiveUpdates } from '../hooks/useLiveUpdates';

export default function DashboardPage() {
    const [systems, setSystems] = useState([
        { id: 'sys-a', name: 'System A', metrics: { temp: 25, ph: 6.5 } },
        { id: 'sys-b', name: 'System B', metrics: { temp: 27, ph: 7.0 } },
    ]);

    const [layers, setLayers] = useState([
        {
            id: 'layer-1',
            name: 'Layer 1',
            metrics: { moisture: 80 },
            devices: [
                { id: 'd1', name: 'Device 1', metrics: { temp: 24 } },
                { id: 'd2', name: 'Device 2', metrics: { temp: 25 } },
            ],
        },
    ]);

    const live = useLiveUpdates();

    useEffect(() => {
        if (!live) return;
        if (Array.isArray(live.systems)) {
            setSystems(live.systems);
        }
        if (Array.isArray(live.layers)) {
            setLayers(live.layers);
        }
    }, [live]);

    return (
        <div className={styles.page}>
            <OverviewList systems={systems} />
            <LayersBoard layers={layers} />
        </div>
    );
}
