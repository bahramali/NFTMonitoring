import React from 'react';
import DeviceCard from './DeviceCard';
import LayerMetrics from './LayerMetrics';
import styles from './LayersBoard.module.css';

export default function LayersBoard({ layers = [] }) {
    return (
        <div className={styles.board}>
            {layers.map((layer) => (
                <div key={layer.id} className={styles.layerCard}>
                    <div className={styles.header}>
                        <h3 className={styles.title}>{layer.name}</h3>
                        {layer.metrics ? <LayerMetrics metrics={layer.metrics} /> : null}
                    </div>
                    <div className={styles.devices}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {layer.devices?.map((dev) => (
                            <DeviceCard key={dev.id} name={dev.name} metrics={dev.metrics} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
