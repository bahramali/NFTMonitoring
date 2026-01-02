// no JSX here, so .js extension is fine
import React from 'react';
import { render } from '@testing-library/react';
import { SensorConfigProvider } from '../../src/context/SensorConfigContext.jsx';

export function renderWithProviders(ui, options) {
  // wrap ui with provider without JSX
  const wrapped = React.createElement(
    SensorConfigProvider,
    { allowUnauthenticated: true, locationPath: '/monitoring' },
    ui,
  );
  return render(wrapped, options);
}
