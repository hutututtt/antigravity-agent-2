// API Configuration
export const API_CONFIG = {
    // Default API base URL (can be overridden by environment variable)
    BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000',
    // BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://47.93.28.155:3000',

    // API endpoints
    ENDPOINTS: {
        CARD_VERIFY: '/api/card/verify',
        ACCOUNT_GET_PASSWORD: '/api/account/get-password',
        ACCOUNT_UPDATE_STATUS: '/api/account/update-status',
        AUTO_LOGIN: '/api/auto-login',
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
