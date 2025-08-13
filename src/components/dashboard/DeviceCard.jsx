import React from 'react';
import MetricCard from './MetricCard';

export default function DeviceCard({ name, metrics = {} }) {
    return (
        <div className="bg-white border rounded shadow-sm p-4">
            <h4 className="font-medium mb-2">{name}</h4>
            <div className="grid grid-cols-2 gap-2">
                {Object.entries(metrics).map(([key, val]) => (
                    <MetricCard key={key} title={key} value={val} />
                ))}
            </div>
        </div>
    );
}
