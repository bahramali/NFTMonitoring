import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { SensorConfigProvider } from './context/SensorConfigContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SensorConfigProvider>
            <App />
        </SensorConfigProvider>
    </React.StrictMode>,
);
