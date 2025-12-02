import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initApiConfig } from './config/api';

// Initialize API configuration from localStorage
initApiConfig();

ReactDOM.createRoot(document.getElementById('app')).render(
    <App />
);