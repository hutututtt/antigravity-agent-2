import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

// API Configuration
export const API_CONFIG = {
    // Default API base URL (can be overridden by environment variable)
    // BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000',
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://47.93.28.155:3000',

    // API endpoints
    ENDPOINTS: {
        CARD_VERIFY: '/api/card/verify',
        ACCOUNT_GET_PASSWORD: '/api/account/get-password',
        ACCOUNT_UPDATE_STATUS: '/api/account/update-status',
        AUTO_LOGIN: '/api/auto-login',
        ACCOUNT_FEEDBACK: '/api/account/feedback',
    }
};

// Helper function to get full API URL
export function getApiUrl(endpoint: string): string {
    return `${API_CONFIG.BASE_URL}${endpoint}`;
}

// Helper function to update API base URL at runtime
export function setApiBaseUrl(url: string): void {
    API_CONFIG.BASE_URL = url;
    // Save to localStorage for persistence
    localStorage.setItem('api_base_url', url);
}

// Initialize API base URL from localStorage if available
export function initApiConfig(): void {
    const savedUrl = localStorage.getItem('api_base_url');
    if (savedUrl) {
        API_CONFIG.BASE_URL = savedUrl;
    }
}

// Wrapper for fetch to handle CORS in Tauri
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        // Try using Tauri's native HTTP client first (bypasses CORS)
        // Tauri fetch returns standard Response object
        return await tauriFetch(input, init);
    } catch (e) {
        console.warn('Tauri fetch failed, falling back to browser fetch', e);
        // Fallback to browser fetch for development
        return await fetch(input, init);
    }
}
