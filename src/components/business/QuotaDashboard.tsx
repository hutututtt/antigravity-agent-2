import React, { useState, useEffect } from 'react';
import { GlassProgressBar } from '../base-ui/GlassProgressBar';
import { cn } from '@/utils/utils';
import './QuotaDashboard.css';

interface QuotaInfo {
    remainingFraction: number;
    resetTime: string;
}

interface ModelConfig {
    label: string;
    quotaInfo: QuotaInfo;
}

interface QuotaDashboardProps {
    models: ModelConfig[];
    className?: string;
}

// 根据剩余配额获取颜色配置（剩余越少，颜色越红）
const getProgressConfig = (remaining: number) => {
    if (remaining <= 0.1) {
        return {
            from: 'from-red-500',
            to: 'to-rose-600',
            textColor: 'text-red-600 dark:text-red-400'
        };
    } else if (remaining <= 0.3) {
        return {
            from: 'from-amber-400',
            to: 'to-orange-500',
            textColor: 'text-orange-600 dark:text-orange-400'
        };
    } else if (remaining <= 0.6) {
        return {
            from: 'from-blue-400',
            to: 'to-indigo-500',
            textColor: 'text-blue-600 dark:text-blue-400'
        };
    } else {
        return {
            from: 'from-emerald-400',
            to: 'to-teal-500',
            textColor: 'text-emerald-600 dark:text-emerald-400'
        };
    }
};

// 格式化倒计时时间（精确到秒）
const formatCountdown = (resetTime: string): string => {
    const reset = new Date(resetTime);
    const now = new Date();
    const totalSeconds = Math.max(0, Math.floor((reset.getTime() - now.getTime()) / 1000));

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (seconds > 0) {
        return `${seconds}秒`;
    } else {
        return '已重置';
    }
};

export const QuotaDashboard: React.FC<QuotaDashboardProps> = ({ models, className }) => {
    const [, setTick] = useState(0);

    // 每秒更新一次倒计时
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className={cn("bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 quota-dashboard-entry", className)}>
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        当前配额详情
                    </h3>
                </div>

                {/* 单行 6 列布局 - 美化版 */}
                <div className="grid grid-cols-6 gap-2">
                    {models.map((model, index) => {
                        const percentage = (model.quotaInfo?.remainingFraction ?? 0) * 100;

                        // 根据配额百分比选择颜色方案
                        const getColorScheme = () => {
                            if (percentage >= 100) return {
                                bg: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
                                border: 'border-emerald-200 dark:border-emerald-700',
                                text: 'text-emerald-700 dark:text-emerald-400',
                                gradient: 'from-emerald-500 to-green-500'
                            };
                            if (percentage >= 50) return {
                                bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
                                border: 'border-blue-200 dark:border-blue-700',
                                text: 'text-blue-700 dark:text-blue-400',
                                gradient: 'from-blue-500 to-cyan-500'
                            };
                            if (percentage >= 30) return {
                                bg: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
                                border: 'border-amber-200 dark:border-amber-700',
                                text: 'text-amber-700 dark:text-amber-400',
                                gradient: 'from-amber-500 to-orange-500'
                            };
                            return {
                                bg: 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20',
                                border: 'border-red-200 dark:border-red-700',
                                text: 'text-red-700 dark:text-red-400',
                                gradient: 'from-red-500 to-rose-500'
                            };
                        };

                        const colors = getColorScheme();

                        return (
                            <div
                                key={index}
                                className={cn(
                                    "bg-gradient-to-br rounded-lg p-2 border shadow-sm",
                                    "hover:shadow-md transition-all duration-200 hover:scale-[1.02]",
                                    colors.bg,
                                    colors.border
                                )}
                            >
                                {/* 模型名称和百分比 */}
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate pr-1">
                                        {model.label}
                                    </span>
                                    <span className={cn("text-xs font-bold tabular-nums", colors.text)}>
                                        {percentage.toFixed(0)}%
                                    </span>
                                </div>

                                {/* 进度条 - 带光泽效果 */}
                                <div className="relative h-1.5 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden mb-1">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-500 bg-gradient-to-r",
                                            colors.gradient
                                        )}
                                        style={{ width: `${percentage}%` }}
                                    >
                                        {/* 光泽效果 */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                    </div>
                                </div>

                                {/* 倒计时 */}
                                {model.quotaInfo?.resetTime && (
                                    <div className="text-[8px] text-gray-600 dark:text-gray-400 tabular-nums text-center font-medium">
                                        {formatCountdown(model.quotaInfo.resetTime)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
