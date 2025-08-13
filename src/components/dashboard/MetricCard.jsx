import React from 'react';

export default function MetricCard({ title, value, unit }) {
    return (
        <div className="bg-white rounded shadow p-4 text-center">
            <div className="text-sm text-gray-500">{title}</div>
            <div className="text-2xl font-semibold">
                {value}
                {unit ? <span className="ml-1 text-base font-normal">{unit}</span> : null}
            </div>
        </div>
    );
}
