import React, { useState, useEffect } from 'react';
import { LanguageServerResponse } from '@/commands/types/language-server-response.types';
import { cn } from '@/utils/utils';
import { Check } from 'lucide-react';

interface QuotaProgressBarProps {
    quota?: LanguageServerResponse.QuotaInfo;
    onQuotaReset?: () => void; // 配额重置时的回调
}

export const QuotaProgressBar: React.FC<QuotaProgressBarProps> = ({ quota, onQuotaReset }) => {
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!quota?.resetTime) return;

        const updateCountdown = () => {
            const now = Date.now();
            const resetTime = new Date(quota.resetTime).getTime();
            const diff = resetTime - now;

            if (diff <= 0) {
                setIsReady(true);
                setTimeRemaining('已就绪');
                // 触发配额刷新回调
                if (onQuotaReset && !isReady) {
                    onQuotaReset();
                }
                return;
            }

            setIsReady(false);
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [quota?.resetTime, onQuotaReset, isReady]);

    // 配额百分比：如果已就绪，显示 100%，否则显示实际值
    const percentage = isReady ? 100 : ((quota?.remainingFraction ?? 0) * 100);

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">剩余配额</span>
                <span className={cn(
                    "font-mono font-semibold",
                    isReady
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-800 dark:text-gray-200"
                )}>
                    {percentage.toFixed(0)}%
                </span>
            </div>

            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full transition-all duration-300",
                        isReady
                            ? "bg-gradient-to-r from-green-500 to-emerald-500"
                            : percentage < 30
                                ? "bg-gradient-to-r from-red-500 to-red-600"
                                : percentage < 50
                                    ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                    : "bg-gradient-to-r from-blue-500 to-blue-600"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="flex items-center justify-between text-[10px]">
                <span className={cn(
                    "flex items-center gap-1",
                    isReady ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"
                )}>
                    {isReady && <Check className="h-3 w-3" />}
                    {isReady ? '配额已恢复' : `重置倒计时: ${timeRemaining}`}
                </span>
            </div>
        </div>
    );
};
