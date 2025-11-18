// no JSX here, so .js extension is fine
import React, { act } from 'react';
import { render } from '@testing-library/react';
import { SensorConfigProvider } from '../../src/context/SensorConfigContext.jsx';

export async function renderWithProviders(ui, options) {
  let renderResult;
  await act(async () => {
    // wrap ui with provider without JSX
    const wrapped = React.createElement(SensorConfigProvider, null, ui);
    renderResult = render(wrapped, options);
  });
  return renderResult;
}
