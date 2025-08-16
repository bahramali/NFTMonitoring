import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterBar from '../src/components/dashboard/FilterBar';

const systems = [
  {
    systemId: 'S01',
    _layerCards: [{ id: 'L01' }, { id: 'L02' }],
  },
  {
    systemId: 'S02',
    _layerCards: [{ id: 'L01' }],
  },
];

function TestDashboard() {
  const [selected, setSelected] = useState({
    S01: { L01: true, L02: true },
    S02: { L01: true },
  });
  const handleToggle = (sysId, layerId) => {
    setSelected((prev) => ({
      ...prev,
      [sysId]: { ...prev[sysId], [layerId]: !prev[sysId][layerId] },
    }));
  };

  return (
    <div>
      <FilterBar systems={systems} selected={selected} onToggle={handleToggle} />
      {systems.map((sys) => {
        const layers = sys._layerCards.filter((l) => selected[sys.systemId][l.id]);
        if (layers.length === 0) return null;
        return (
          <div key={sys.systemId} data-testid={`system-${sys.systemId}`}>
            {layers.map((l) => (
              <div key={l.id} data-testid={`layer-${sys.systemId}-${l.id}`}>
                {l.id}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

test('filters layers and systems based on selections', () => {
  render(<TestDashboard />);
  expect(screen.getByTestId('layer-S01-L01')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('S01-L01'));
  expect(screen.queryByTestId('layer-S01-L01')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('S02-L01'));
  expect(screen.queryByTestId('system-S02')).not.toBeInTheDocument();
});
