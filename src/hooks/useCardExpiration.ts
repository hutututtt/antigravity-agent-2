import { useState, useEffect } from 'react';
import { useAntigravityAccount } from '@/modules/use-antigravity-account.ts';
import { AntigravityService } from '@/services/antigravity-service';
import { getApiUrl, API_CONFIG, safeFetch } from '@/config/api';

export type ExpirationStatus = 'valid' | 'expiring' | 'expired' | 'no_card';

interface CardInfo {
    type: string;
    typeName: string;
    expireTime: string;
    expireDays: number;
    status: string;
}

interface UseCardExpirationResult {
    status: ExpirationStatus;
    daysLeft: number;
    cardInfo: CardInfo | null;
    checkExpiration: () => void;
}

export const useCardExpiration = (): UseCardExpirationResult => {
    // 初始状态设为 'valid'，避免在检查完成前就触发 no_card 对话框
    const [status, setStatus] = useState<ExpirationStatus>('valid');
    const [daysLeft, setDaysLeft] = useState<number>(0);
    const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);

    const checkExpiration = () => {
        try {
            const savedCardInfo = localStorage.getItem('antigravity_card_info');
            console.log('[useCardExpiration] checkExpiration called', {
                hasCardInfo: !!savedCardInfo,
                currentStatus: status,
                timestamp: new Date().toISOString()
            });

            if (!savedCardInfo) {
                setCardInfo(null);
                setStatus('no_card');
                console.log('[useCardExpiration] No card info found, status set to no_card');
                return;
            }

            const parsedInfo: CardInfo = JSON.parse(savedCardInfo);
            setCardInfo(parsedInfo);

            const expireTime = new Date(parsedInfo.expireTime).getTime();
            const now = Date.now();
            const diffTime = expireTime - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setDaysLeft(diffDays);

            // ...

            if (diffTime <= 0) {
                setStatus('expired');

                // Clear local storage to prevent infinite restart loop
                localStorage.removeItem('antigravity_card_info');
                localStorage.removeItem('antigravity_card_input');
                localStorage.removeItem('antigravity_accounts');
                setCardInfo(null);

                // Clear all data and restart if expired (Factory Reset)
                AntigravityService.clearAndRestartAntigravity().then(async () => {
                    // Sync frontend state
                    await useAntigravityAccount.getState().clearAllUsers();
                    await useAntigravityAccount.getState().updateCurrentAccount();

                    // Dispatch event to notify other components
                    window.dispatchEvent(new Event('antigravity_card_update'));
                });
            } else if (diffDays <= 3) {
                setStatus('expiring');
                console.log('[useCardExpiration] Card expiring soon', { diffDays });
            } else {
                setStatus('valid');
                console.log('[useCardExpiration] Card is valid', { diffDays });

                // Perform server-side verification if we have a card code
                const cardCode = localStorage.getItem('antigravity_card_input');
                if (cardCode) {
                    verifyCardStatus(cardCode);
                }
            }
        } catch (error) {
            console.error('Failed to check card expiration:', error);
            setStatus('valid');
        }
    };

    const verifyCardStatus = async (cardCode: string) => {
        try {


            // ...

            const response = await safeFetch(getApiUrl(API_CONFIG.ENDPOINTS.CARD_VERIFY), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardCode }),
            });
            const data = await response.json();

            // If card is invalid (code != 200), clear everything
            if (data.code !== 200) {
                console.warn('Card validation failed:', data.message);
                setStatus('expired');

                // Clear local storage to prevent infinite restart loop
                localStorage.removeItem('antigravity_card_info');
                localStorage.removeItem('antigravity_card_input');
                localStorage.removeItem('antigravity_accounts');
                setCardInfo(null);

                AntigravityService.clearAndRestartAntigravity().then(async () => {
                    await useAntigravityAccount.getState().clearAllUsers();
                    await useAntigravityAccount.getState().updateCurrentAccount();
                    window.dispatchEvent(new Event('antigravity_card_update'));
                });
            } else {
                // Optionally update local card info with latest from server
                if (data.data && data.data.cardInfo) {
                    localStorage.setItem('antigravity_card_info', JSON.stringify(data.data.cardInfo));
                    setCardInfo(data.data.cardInfo);
                }
            }
        } catch (error) {
            console.error('Server verification failed:', error);
            // Don't clear on network error, only on explicit rejection
        }
    };

    // Check on mount and when localStorage changes (if possible, but storage event only works across tabs)
    // We'll expose checkExpiration so components can trigger a re-check
    useEffect(() => {
        checkExpiration();

        // Optional: Poll every minute to update status if the app is left open
        const interval = setInterval(checkExpiration, 60000);
        return () => clearInterval(interval);
    }, []);

    // Listen for custom event or storage event if needed, but for now manual trigger or polling is enough
    // We can add a window event listener if we want to react to login/logout immediately across components
    useEffect(() => {
        const handleStorageChange = () => {
            checkExpiration();
        };

        // Listen to local storage changes (mostly for multi-tab, but good practice)
        window.addEventListener('storage', handleStorageChange);

        // Custom event for same-tab updates
        window.addEventListener('antigravity_card_update', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('antigravity_card_update', handleStorageChange);
        };
    }, []);

    return { status, daysLeft, cardInfo, checkExpiration };
};
