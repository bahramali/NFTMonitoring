import React from 'react';

function ComparePanel({ items = [], onClear }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: '10px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>Compare ({items.length})</div>
        {items.length > 0 && (
          <button type="button" onClick={onClear}>Clear All</button>
        )}
      </div>
      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div>No filters selected.</div>
        ) : (
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {items.map((f, idx) => (
              <li key={idx}>
                Timing: {f.timing?.join(', ') || 'None'}; Location: {f.location?.join(', ') || 'None'}; Sensor: {f.sensorType?.join(', ') || 'None'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ComparePanel;

