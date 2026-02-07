import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('Overview filters and drawer', () => {
  test('filters devices and opens drawer', async () => {
    listDevices.mockResolvedValue([
      {
        farmId: 'F01',
        unitType: 'GARDEN',
        unitId: 'R01',
        layerId: 'L04',
        deviceId: 'DEV-1',
        kind: 'TANK',
        lastSeen: new Date().toISOString(),
        msgRate: 6,
        metrics: { ph: 6.1, ec: 1.2, solutionTemp: 21 }
      },
      {
        farmId: 'F01',
        unitType: 'GERMINATION',
        unitId: 'GRM01',
        layerId: null,
        deviceId: 'DEV-2',
        kind: 'ENV',
        lastSeen: new Date().toISOString(),
        msgRate: 6
      }
    ]);

    render(
      <MemoryRouter initialEntries={['/monitoring/overview']}>
        <Overview />
      </MemoryRouter>
    );

    expect(await screen.findByText('DEV-1')).toBeInTheDocument();

    const search = screen.getByLabelText(/search/i);
    fireEvent.change(search, { target: { value: 'DEV-1' } });

    await waitFor(() => {
      expect(screen.queryByText('DEV-2')).not.toBeInTheDocument();
    });

    const detailsButton = screen.getAllByRole('button', { name: /details/i })[0];
    fireEvent.click(detailsButton);

    expect(await screen.findByText('Device Details')).toBeInTheDocument();
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('DEV-1')).toBeInTheDocument();
  });
});
