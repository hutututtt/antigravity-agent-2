import React from 'react';
import { LanguageServerResponse } from '@/commands/types/language-server-response.types';
import { cn } from '@/utils/utils';

interface QuotaProgressBarProps {
    quota?: LanguageServerResponse.QuotaInfo;
    className?: string;
}

export const QuotaProgressBar: React.FC<QuotaProgressBarProps> = ({ quota, className }) => {
    if (!quota) return null;

    const percentage = Math.max(0, Math.min(100, quota.remainingFraction * 100));

    let colorClass = 'bg-green-500';
    if (percentage < 30) {
        colorClass = 'bg-red-500';
    } else if (percentage < 50) {
        colorClass = 'bg-yellow-500';
    }

    return (
        <div className={cn("w-full", className)}>
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>剩余配额</span>
                <span>{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all duration-500", colorClass)}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};
