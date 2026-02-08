import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Overview from '../src/pages/Overview/index.jsx';
import { listDevices } from '../src/api/deviceMonitoring.js';

vi.mock('../src/api/deviceMonitoring.js', () => ({
  listDevices: vi.fn()
}));

vi.mock('../src/hooks/useStomp.js', () => ({
  useStomp: () => {}
}));

vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ role: 'ADMIN', roles: ['ADMIN'] })
}));

describe('Overview hierarchical view', () => {
  test('expands hierarchy and opens details', async () => {
    listDevices.mockResolvedValue([
      {
        farmId: 'F01',
        unitType: 'GARDEN',
        unitId: 'R01',
        layerId: 'L01',
        deviceId: 'DEV-1',
        kind: 'TANK',
        lastSeen: new Date().toISOString(),
        msgRate: 6,
        metrics: { ph: 6.2, ec: 1.1, solutionTemp: 21.2 }
      }
    ]);

    render(
      <MemoryRouter initialEntries={['/monitoring/overview']}>
        <Overview />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText(/view/i), { target: { value: 'hierarchical' } });

    fireEvent.click(await screen.findByRole('button', { name: /F01/i }));
    fireEvent.click(await screen.findByRole('button', { name: /GARDEN/i }));
    fireEvent.click(await screen.findByRole('button', { name: /R01/i }));
    fireEvent.click(await screen.findByRole('button', { name: /L01/i }));
    fireEvent.click(await screen.findByRole('button', { name: /TANK/i }));

    fireEvent.click(await screen.findByRole('button', { name: /details/i }));

    expect(await screen.findByText(/Health reasons/i)).toBeInTheDocument();
    expect(await screen.findByText(/Sensor Overview/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '15m' })).toBeInTheDocument();
    expect((await screen.findAllByText(/Δ/i)).length).toBeGreaterThan(0);
  });
});
