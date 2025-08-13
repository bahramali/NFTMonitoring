import React from 'react';
import MetricCard from './MetricCard';

export default function LayerMetrics({ metrics = {} }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics).map(([key, val]) => (
                <MetricCard key={key} title={key} value={val} />
            ))}
        </div>
    );
}
