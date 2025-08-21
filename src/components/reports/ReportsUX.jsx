import React from 'react';

function ReportsUX() {
  return (
    <div className="container mx-auto p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="p-4 border rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Reports</h2>
          <p className="mb-4">Select a report to view detailed metrics.</p>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2 bg-blue-500 text-white rounded">Run</button>
            <button type="button" className="px-4 py-2 border rounded">Export</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsUX;
