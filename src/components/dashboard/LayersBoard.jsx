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
                        {layer.devices?.map((dev) => (
                            <DeviceCard key={dev.id} name={dev.name} metrics={dev.metrics} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
