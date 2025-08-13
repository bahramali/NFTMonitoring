import React from 'react';
import MetricCard from './MetricCard';

export default function OverviewList({ systems = [] }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((sys) => (
                <div key={sys.id} className="bg-white rounded shadow p-4">
                    <h3 className="text-lg font-semibold mb-2">{sys.name}</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {sys.metrics &&
                            Object.entries(sys.metrics).map(([key, val]) => (
                                <MetricCard key={key} title={key} value={val} />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
