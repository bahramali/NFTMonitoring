import React from 'react';

function TablePanel({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data available.</div>;
  }

  const headers = Object.keys(data[0] || {});

  return (
    <table>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {headers.map((h) => (
              <td key={h}>{String(row[h])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default TablePanel;
