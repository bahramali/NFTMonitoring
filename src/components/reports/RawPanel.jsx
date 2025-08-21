import React from 'react';

function RawPanel({ data = [] }) {
  return (
    <pre style={{ overflowX: 'auto' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default RawPanel;
