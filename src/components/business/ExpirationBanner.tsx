import React from 'react';
import { AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { BaseButton } from '@/components/base-ui/BaseButton';
import { cn } from '@/utils/utils';
import { ExpirationStatus } from '@/hooks/useCardExpiration';

interface ExpirationBannerProps {
    status: ExpirationStatus;
    daysLeft: number;
    onRenew: () => void;
    onClose?: () => void;
}

const ExpirationBanner: React.FC<ExpirationBannerProps> = ({
    status,
    daysLeft,
    onRenew,
    onClose
}) => {
    if (status === 'valid') return null;

    const isExpired = status === 'expired';

    return (
        <div className={cn(
            "w-full px-4 py-3 flex items-center justify-between transition-all duration-300",
            isExpired
                ? "bg-red-500 text-white"
                : "bg-amber-100 text-amber-900 border-b border-amber-200"
        )}>
            <div className="flex items-center gap-3">
                {isExpired ? (
                    <XCircle className="h-5 w-5 shrink-0" />
                ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="font-bold text-sm">
                        {isExpired ? '您的卡密已过期' : '您的卡密即将过期'}
                    </span>
                    <span className={cn(
                        "text-xs sm:text-sm opacity-90",
                        isExpired ? "text-red-100" : "text-amber-700"
                    )}>
                        {isExpired
                            ? '为了不影响您的使用，请尽快续费'
                            : `剩余有效期仅剩 ${daysLeft} 天，请及时续费`
                        }
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <BaseButton
                    size="sm"
                    onClick={onRenew}
                    className={cn(
                        "h-8 px-3 text-xs font-medium border-none shadow-none hover:bg-white/20",
                        isExpired
                            ? "bg-white text-red-600 hover:bg-white hover:text-red-700"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                    )}
                    rightIcon={<ChevronRight className="h-3 w-3" />}
                >
                    立即续费
                </BaseButton>

                {!isExpired && onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-black/5 rounded-full transition-colors"
                    >
                        <XCircle className="h-5 w-5 opacity-40 hover:opacity-70" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ExpirationBanner;
