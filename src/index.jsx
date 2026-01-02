import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { enableFetchLogging } from './utils/logFetch.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { StorefrontProvider } from './context/StorefrontContext.jsx';

const shouldEnableFetchLogs = import.meta.env.VITE_ENABLE_FETCH_LOGS === 'true';
if (shouldEnableFetchLogs) {
    enableFetchLogging();
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <StorefrontProvider>
                <App />
            </StorefrontProvider>
        </AuthProvider>
    </React.StrictMode>,
);
