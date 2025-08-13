import React from 'react';
import DeviceCard from './DeviceCard';
import LayerMetrics from './LayerMetrics';

export default function LayersBoard({ layers = [] }) {
    return (
        <div className="space-y-4">
            {layers.map((layer) => (
                <div key={layer.id} className="bg-gray-50 rounded p-4">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold">{layer.name}</h3>
                        {layer.metrics ? <LayerMetrics metrics={layer.metrics} /> : null}
                    </div>
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
