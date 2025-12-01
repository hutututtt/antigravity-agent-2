import React, { useEffect, useState } from 'react';
import { Network, RefreshCw, Shield, Globe, Server, Wifi } from 'lucide-react';
import { BaseDialog, BaseDialogContent, BaseDialogHeader, BaseDialogTitle } from '@/components/base-ui/BaseDialog';
import { BaseButton } from '@/components/base-ui/BaseButton';
import { BaseSpinner } from '@/components/base-ui/BaseSpinner';
import { NetworkService, NetworkStatus } from '@/services/network-service';
import { cn } from '@/utils/utils';

interface NetworkCheckDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const NetworkCheckDialog: React.FC<NetworkCheckDialogProps> = ({
    isOpen,
    onOpenChange
}) => {
    const [status, setStatus] = useState<NetworkStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkNetwork = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await NetworkService.getNetworkStatus();
            setStatus(result);
        } catch (err) {
            setError('网络检测失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            checkNetwork();
        }
    }, [isOpen]);

    const getRiskColor = (score: number) => {
        if (score === 0) return 'text-green-600 dark:text-green-400';
        if (score < 30) return 'text-blue-600 dark:text-blue-400';
        if (score < 60) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getRiskBgColor = (score: number) => {
        if (score === 0) return 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800';
        if (score < 30) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800';
        if (score < 60) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800';
        return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800';
    };

    return (
        <BaseDialog open={isOpen} onOpenChange={onOpenChange}>
            <BaseDialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 shadow-2xl">
                <BaseDialogHeader className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-row items-center justify-between">
                    <BaseDialogTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Network className="h-4 w-4 text-gray-500" />
                        <span>网络环境检测</span>
                    </BaseDialogTitle>
                    <BaseButton
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mr-8"
                        onClick={checkNetwork}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </BaseButton>
                </BaseDialogHeader>

                <div className="p-5 space-y-6">
                    {isLoading && !status ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <BaseSpinner size="default" />
                            <p className="text-gray-400 mt-3 text-xs">正在检测网络环境...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500 text-sm">{error}</div>
                    ) : status ? (
                        <>
                            {/* Score Card */}
                            <div className={cn(
                                "rounded-xl p-4 border flex items-center justify-between",
                                getRiskBgColor(status.risk.score)
                            )}>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">环境风险评分</div>
                                    <div className={cn("text-2xl font-bold", getRiskColor(status.risk.score))}>
                                        {status.risk.score} <span className="text-sm font-normal text-gray-500">分</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">IP 类型</div>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        {status.type === 'residential' && <Shield className="h-4 w-4 text-green-500" />}
                                        {status.type === 'datacenter' && <Server className="h-4 w-4 text-amber-500" />}
                                        {status.type === 'vpn' && <Wifi className="h-4 w-4 text-red-500" />}
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {status.type === 'residential' ? '住宅 IP' :
                                                status.type === 'datacenter' ? '数据中心' :
                                                    status.type === 'vpn' ? 'VPN/代理' : '未知类型'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Globe className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-xs font-medium text-gray-500">地理位置</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={`${status.ip?.country} - ${status.ip?.city}`}>
                                        {status.ip ? `${status.ip.country} ${status.ip.city}` : '未知'}
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Server className="h-3.5 w-3.5 text-purple-500" />
                                        <span className="text-xs font-medium text-gray-500">运营商 (ISP)</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={status.ip?.org}>
                                        {status.ip?.org || '未知'}
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wifi className="h-3.5 w-3.5 text-orange-500" />
                                        <span className="text-xs font-medium text-gray-500">TUN 接口</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {status.tun.detected ? (
                                            <span className="text-amber-600 dark:text-amber-400">已检测到</span>
                                        ) : (
                                            <span className="text-green-600 dark:text-green-400">未检测到</span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="h-3.5 w-3.5 text-teal-500" />
                                        <span className="text-xs font-medium text-gray-500">IP 地址</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={status.ip?.ip}>
                                        {status.ip?.ip || '未知'}
                                    </div>
                                </div>
                            </div>

                            {/* Risk Reasons */}
                            {status.risk.reasons.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-medium text-gray-500 px-1">检测详情</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {status.risk.reasons.map((reason, index) => (
                                            <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-md border border-gray-200 dark:border-gray-700">
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </BaseDialogContent>
        </BaseDialog>
    );
};

export default NetworkCheckDialog;
