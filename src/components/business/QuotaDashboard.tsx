import React from 'react';
import { GlassProgressBar } from '../base-ui/GlassProgressBar';
import { cn } from '@/utils/utils';
import './QuotaDashboard.css';

interface QuotaInfo {
    remainingFraction: number;
}

interface ModelConfig {
    label: string;
    quotaInfo: QuotaInfo;
}

interface QuotaDashboardProps {
    models: ModelConfig[];
    className?: string;
}

// 根据使用率获取颜色配置
const getProgressConfig = (usage: number) => {
    if (usage >= 0.9) {
        return {
            from: 'from-red-500',
            to: 'to-rose-600',
            textColor: 'text-red-600 dark:text-red-400'
        };
    } else if (usage >= 0.7) {
        return {
            from: 'from-amber-400',
            to: 'to-orange-500',
            textColor: 'text-orange-600 dark:text-orange-400'
        };
    } else if (usage >= 0.4) {
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

export const QuotaDashboard: React.FC<QuotaDashboardProps> = ({ models, className }) => {
    return (
        <div className={cn("bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 quota-dashboard-entry", className)}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>当前会话配额</span>
                <span className="h-px flex-1 bg-gray-100 dark:bg-gray-700"></span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {models.map((model, idx) => {
                    const usageValue = 1 - model.quotaInfo.remainingFraction;
                    const config = getProgressConfig(usageValue);

                    return (
                        <div key={`${model.label}-${idx}`} className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate" title={model.label}>
                                    {model.label}
                                </span>
                                <span className={cn("text-sm font-bold font-mono", config.textColor)}>
                                    {(usageValue * 100).toFixed(0)}%
                                </span>
                            </div>
                            <GlassProgressBar
                                value={usageValue}
                                height="h-3"
                                className="w-full bg-gray-200 dark:bg-gray-700 border-0"
                                gradientFrom={config.from}
                                gradientTo={config.to}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
