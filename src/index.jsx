import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { SensorConfigProvider } from './context/SensorConfigContext.jsx';
import { enableFetchLogging } from './utils/logFetch.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { StorefrontProvider } from './context/StorefrontContext.jsx';

enableFetchLogging();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SensorConfigProvider>
            <AuthProvider>
                <StorefrontProvider>
                    <App />
                </StorefrontProvider>
            </AuthProvider>
        </SensorConfigProvider>
    </React.StrictMode>,
);
