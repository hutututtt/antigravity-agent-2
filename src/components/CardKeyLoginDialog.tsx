import React, { useEffect, useState } from 'react';
import { Key, Copy, CheckCircle, Loader2, Mail, Lock, Shield, Clock, User, RefreshCw, Sparkles, Zap, Globe, AlertTriangle } from 'lucide-react';
import { BaseDialog, BaseDialogContent, BaseDialogHeader, BaseDialogTitle } from '@/components/base-ui/BaseDialog';
import { BaseButton } from '@/components/base-ui/BaseButton';
import { logger } from '@/utils/logger';
import toast from 'react-hot-toast';
import { generateTOTP } from '@/utils/totp';
import { getApiUrl, API_CONFIG, safeFetch } from '@/config/api';
import { cn } from '@/utils/utils';

interface CardKeyLoginDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CardInfo {
    type: string;
    typeName: string;
    expireTime: string;
    expireDays: number;
    status: string;
}

interface Account {
    id: number;
    email: string;
    rentType: string;
    rentTypeName: string;
    expireTime: string;
    status: string;
    statusName: string;
    notes?: string;
    password?: string;
    twoFactorSecret?: string;
    feedbackStatus?: 'pending' | 'none';
}

const CardKeyLoginDialog: React.FC<CardKeyLoginDialogProps> = ({
    isOpen,
    onOpenChange
}) => {
    const [cardInput, setCardInput] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('antigravity_card_input') || '';
        }
        return '';
    });
    const [isVerifying, setIsVerifying] = useState(false);
    const [cardInfo, setCardInfo] = useState<CardInfo | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('antigravity_card_info');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved card info', e);
                }
            }
        }
        return null;
    });
    const [accounts, setAccounts] = useState<Account[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('antigravity_accounts');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved accounts', e);
                }
            }
        }
        return [];
    });
    const [otpCodes, setOtpCodes] = useState<Record<number, string>>({});
    const [totpProgress, setTotpProgress] = useState<number>(0);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('antigravity_card_input', cardInput);
    }, [cardInput]);

    useEffect(() => {
        if (cardInfo) {
            localStorage.setItem('antigravity_card_info', JSON.stringify(cardInfo));
        } else {
            localStorage.removeItem('antigravity_card_info');
        }
    }, [cardInfo]);

    useEffect(() => {
        if (accounts.length > 0) {
            localStorage.setItem('antigravity_accounts', JSON.stringify(accounts));
        } else {
            localStorage.removeItem('antigravity_accounts');
        }
    }, [accounts]);

    // Update OTPs every second
    useEffect(() => {
        if (!isOpen || accounts.length === 0) return;

        const updateOTPs = async () => {
            const newOtps: Record<number, string> = {};
            for (const account of accounts) {
                if (account.twoFactorSecret) {
                    try {
                        // Validate base32 format before generating TOTP
                        const cleanSecret = account.twoFactorSecret.replace(/\s/g, '').toUpperCase();
                        if (!/^[A-Z2-7]+=*$/.test(cleanSecret)) {
                            newOtps[account.id] = '无效密钥';
                            continue;
                        }
                        newOtps[account.id] = await generateTOTP(cleanSecret);
                    } catch (e) {
                        console.error(`Failed to generate TOTP for ${account.email}`, e);
                        newOtps[account.id] = '生成失败';
                    }
                }
            }
            setOtpCodes(newOtps);

            // Update progress
            const epoch = Math.floor(Date.now() / 1000);
            const progress = ((epoch % 30) / 30) * 100;
            setTotpProgress(progress);
        };

        updateOTPs();
        const interval = setInterval(updateOTPs, 1000);
        return () => clearInterval(interval);
    }, [isOpen, accounts]);

    // Listen for global card updates (e.g. from expiration hook)
    useEffect(() => {
        const handleCardUpdate = () => {
            const savedCardInfo = localStorage.getItem('antigravity_card_info');
            const savedAccounts = localStorage.getItem('antigravity_accounts');
            const savedCardInput = localStorage.getItem('antigravity_card_input');

            if (!savedCardInfo) {
                setCardInfo(null);
                setAccounts([]);
                setCardInput(savedCardInput || '');
                setOtpCodes({});
            } else {
                try {
                    setCardInfo(JSON.parse(savedCardInfo));
                    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
                    if (savedCardInput) setCardInput(savedCardInput);
                } catch (e) {
                    console.error('Failed to sync card info', e);
                }
            }
        };

        window.addEventListener('antigravity_card_update', handleCardUpdate);
        return () => window.removeEventListener('antigravity_card_update', handleCardUpdate);
    }, []);

    const handleVerifyCard = async () => {
        await verifyCardInternal(true); // true = close dialog on success
    };

    const refreshAccountList = async () => {
        await verifyCardInternal(false); // false = don't close dialog
    };

    const verifyCardInternal = async (closeOnSuccess: boolean) => {
        if (!cardInput.trim() || cardInput.trim().length !== 32) {
            toast.error('请输入32位卡密');
            return;
        }

        setIsVerifying(true);
        try {
            const apiUrl = getApiUrl(API_CONFIG.ENDPOINTS.CARD_VERIFY);
            logger.info('Verifying card', { apiUrl });

            const response = await safeFetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardCode: cardInput.trim() }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.code !== 200) {
                throw new Error(data.message || '验证失败');
            }

            console.log('[CardKeyLoginDialog] Received account list from backend', {
                accountCount: data.data.accountList.length,
                firstAccount: data.data.accountList[0],
                hasFeedbackStatus: data.data.accountList.every(acc => 'feedbackStatus' in acc),
                timestamp: new Date().toISOString()
            });

            // Reset previous state before setting new card data
            setOtpCodes({});

            const cardInfo = data.data.cardInfo;
            const accountList = data.data.accountList;

            // CRITICAL: Save to localStorage SYNCHRONOUSLY before closing dialog
            // to avoid race condition with App.tsx's onOpenChange check
            localStorage.setItem('antigravity_card_info', JSON.stringify(cardInfo));
            localStorage.setItem('antigravity_accounts', JSON.stringify(accountList));

            // Now update React state (this will trigger useEffect, but localStorage is already saved)
            setCardInfo(cardInfo);
            setAccounts(accountList);

            console.log('[CardKeyLoginDialog] Card verification successful, attempting to close dialog', {
                cardInfo: cardInfo,
                accountCount: accountList.length,
                localStorageHasData: !!localStorage.getItem('antigravity_card_info'),
                closeOnSuccess: closeOnSuccess,
                timestamp: new Date().toISOString()
            });

            // Close dialog only if requested (e.g., initial verification, not refresh)
            if (closeOnSuccess) {
                onOpenChange(false);
                toast.success('卡密验证成功！');
            } else {
                // Just show a subtle success message for refresh
                console.log('[CardKeyLoginDialog] Account list refreshed successfully');
            }

            // Dispatch event to notify other components (e.g., App.tsx to update card status)
            console.log('[CardKeyLoginDialog] Dispatching antigravity_card_update event');
            window.dispatchEvent(new Event('antigravity_card_update'));

        } catch (error) {
            logger.error('卡密验证失败', { error });

            // Provide more helpful error messages
            let errorMessage = '验证失败';
            if (error instanceof TypeError && error.message.includes('fetch')) {
                errorMessage = `无法连接到服务器 (${API_CONFIG.BASE_URL})\n请检查:\n1. 服务器是否运行\n2. 网络连接是否正常\n3. 防火墙设置`;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            toast.error(errorMessage, { duration: 5000 });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleMarkAsUsed = async (accountId: number) => {
        try {
            const response = await safeFetch(getApiUrl(API_CONFIG.ENDPOINTS.ACCOUNT_UPDATE_STATUS), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId,
                    status: 'in_use',
                    cardCode: cardInput.trim()
                }),
            });

            const data = await response.json();

            if (data.code !== 200) {
                throw new Error(data.message || '更新状态失败');
            }

            // Update local state
            setAccounts(prev => prev.map(acc => ({
                ...acc,
                status: acc.id === accountId ? 'in_use' : 'unused',
                statusName: acc.id === accountId ? '使用中' : '可用'
            })));

            toast.success('已标记为使用中');

        } catch (error) {
            logger.error('更新状态失败', { error });
            toast.error(error instanceof Error ? error.message : '更新状态失败');
        }
    };

    const handleAutoLogin = async (accountId: number) => {
        try {
            toast.loading('正在自动登录...', { id: 'auto-login' });

            // Hold Shift key to enable debug mode
            const debugMode = window.event && (window.event as KeyboardEvent).shiftKey;

            if (debugMode) {
                toast.loading('调试模式已启用，浏览器将保持打开...', { id: 'auto-login' });
            }

            const response = await safeFetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTO_LOGIN), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, debug: debugMode, cardCode: cardInput.trim() }),
            });

            const data = await response.json();

            if (data.code !== 200) {
                throw new Error(data.message || '自动登录失败');
            }

            toast.success(data.message, { id: 'auto-login' });

        } catch (error) {
            logger.error('自动登录失败', { error });
            toast.error(error instanceof Error ? error.message : '自动登录失败', { id: 'auto-login' });
        }
    };

    const handleReportInvalid = async (accountId: number) => {
        console.log('[CardKeyLoginDialog] handleReportInvalid called', { accountId, timestamp: new Date().toISOString() });

        try {
            console.log('[CardKeyLoginDialog] Sending feedback request to backend', { accountId, timestamp: new Date().toISOString() });

            const response = await safeFetch(getApiUrl(API_CONFIG.ENDPOINTS.ACCOUNT_FEEDBACK), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId,
                    cardCode: cardInput,
                    feedbackType: 'expired'
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success(data.message || '反馈提交成功');

                // Refresh account list to show updated feedback status (without closing dialog)
                console.log('[CardKeyLoginDialog] Refreshing account list after feedback submission');
                await refreshAccountList();
            } else {
                toast.error(data.message || '反馈提交失败');
            }
        } catch (error) {
            logger.error('反馈提交失败', { error });
            toast.error('反馈提交失败');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`已复制`);
    };

    const resetDialog = () => {
        setCardInput('');
        setCardInfo(null);
        setAccounts([]);
        setOtpCodes({});

        // Clear localStorage
        localStorage.removeItem('antigravity_card_input');
        localStorage.removeItem('antigravity_card_info');
        localStorage.removeItem('antigravity_accounts');
    };

    return (
        <BaseDialog open={isOpen} onOpenChange={onOpenChange}>
            <BaseDialogContent className="max-w-4xl p-0 overflow-hidden bg-[#F7FAFC] dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col rounded-xl">
                <BaseDialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                    <BaseDialogTitle className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        <span>激活卡密</span>
                    </BaseDialogTitle>
                </BaseDialogHeader>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Card Input Section */}
                    {!cardInfo && (
                        <div className="max-w-md mx-auto mt-8 space-y-8">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">请输入您的卡密</h3>
                                <p className="text-gray-500 dark:text-gray-400">输入32位卡密以获取您的专属账号</p>
                            </div>

                            <div className="relative">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-2 flex gap-2 shadow-sm border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                                    <input
                                        type="text"
                                        value={cardInput}
                                        onChange={(e) => setCardInput(e.target.value)}
                                        placeholder="请输入32位卡密..."
                                        maxLength={32}
                                        className="flex-1 px-4 py-2 bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 font-mono text-lg tracking-wide"
                                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyCard()}
                                        autoFocus
                                    />
                                    <BaseButton
                                        onClick={handleVerifyCard}
                                        disabled={isVerifying || cardInput.trim().length !== 32}
                                        className="bg-primary hover:bg-primary/90 text-white px-6 rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                    </BaseButton>
                                </div>
                            </div>

                            <div className="flex justify-center gap-8 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    <span>安全加密</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    <span>即时交付</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4" />
                                    <span>全球可用</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Card Info & Account List */}
                    {cardInfo && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Card Info Banner */}
                            <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary dark:text-blue-400">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{cardInfo.typeName}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                                                    剩余 {cardInfo.expireDays} 天
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    到期时间: {new Date(cardInfo.expireTime).toLocaleDateString('zh-CN')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Change Card Button - Strictly Inline */}
                                    <BaseButton
                                        onClick={resetDialog}
                                        variant="outline"
                                        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                                        size="sm"
                                        leftIcon={<RefreshCw className="w-4 h-4" />}
                                    >
                                        更换卡密
                                    </BaseButton>
                                </div>
                            </div>

                            {/* Account List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        关联账号 ({accounts.length})
                                    </h4>
                                    <BaseButton
                                        onClick={refreshAccountList}
                                        variant="outline"
                                        size="sm"
                                        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                                        disabled={isVerifying}
                                    >
                                        刷新列表
                                    </BaseButton>
                                </div>

                                <div className="grid gap-4">
                                    {accounts.map((account, index) => (
                                        <div
                                            key={account.id}
                                            className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-200"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className="flex flex-col lg:flex-row gap-6">
                                                {/* Left Column: Account Credentials */}
                                                <div className="flex-1 space-y-4">
                                                    {/* Email Field */}
                                                    <div className="relative">
                                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">账号邮箱</label>
                                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-colors">
                                                            <Mail size={16} className="text-gray-400" />
                                                            <code className="flex-1 font-mono text-sm text-gray-900 dark:text-gray-100 truncate select-all">
                                                                {account.email}
                                                            </code>
                                                            <button
                                                                onClick={() => copyToClipboard(account.email)}
                                                                className="text-gray-400 hover:text-primary transition-colors"
                                                                title="复制邮箱"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Password Field */}
                                                    <div className="relative">
                                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">登录密码</label>
                                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 group-hover:border-purple-200 dark:group-hover:border-purple-800 transition-colors">
                                                            <Lock size={16} className="text-gray-400" />
                                                            <code className="flex-1 font-mono text-sm text-gray-900 dark:text-gray-100 truncate select-all">
                                                                {account.password || '••••••••'}
                                                            </code>
                                                            <button
                                                                onClick={() => copyToClipboard(account.password || '')}
                                                                className="text-gray-400 hover:text-primary transition-colors"
                                                                title="复制密码"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Auxiliary Email (if exists) */}
                                                    {account.notes && (
                                                        <div className="relative">
                                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block ml-1">辅助邮箱</label>
                                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 group-hover:border-orange-200 dark:group-hover:border-orange-800 transition-colors">
                                                                <User size={16} className="text-gray-400" />
                                                                <code className="flex-1 font-mono text-sm text-gray-900 dark:text-gray-100 truncate select-all">
                                                                    {account.notes}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(account.notes!)}
                                                                    className="text-gray-400 hover:text-primary transition-colors"
                                                                    title="复制辅助邮箱"
                                                                >
                                                                    <Copy size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right Column: 2FA & Status */}
                                                <div className="lg:w-72 flex flex-col gap-4">
                                                    {/* 2FA Section */}
                                                    <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                                <Shield size={14} />
                                                                <span>2FA 验证码</span>
                                                            </div>
                                                            {otpCodes[account.id] && (
                                                                <div className="w-16 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-1000 ease-linear ${totpProgress > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                                                        style={{ width: `${100 - totpProgress}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {otpCodes[account.id] ? (
                                                            <div className="flex items-center justify-between">
                                                                <code className="text-2xl font-bold text-gray-900 dark:text-white tracking-[0.2em] font-mono">
                                                                    {otpCodes[account.id]}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(otpCodes[account.id])}
                                                                    className="p-2 text-gray-400 hover:text-primary rounded-lg transition-all"
                                                                    title="复制验证码"
                                                                >
                                                                    <Copy size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 flex items-center justify-center text-xs text-gray-400 italic">
                                                                未启用 2FA
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status & Action */}
                                                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                        <div className="flex flex-col">
                                                            <div className={cn(
                                                                "text-xs font-bold px-2.5 py-1 rounded-full w-fit flex items-center gap-1.5",
                                                                account.feedbackStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                    account.status === 'in_use' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                        account.status === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            )}>
                                                                <span className={cn(
                                                                    "w-1.5 h-1.5 rounded-full",
                                                                    account.feedbackStatus === 'pending' ? 'bg-yellow-500' :
                                                                        account.status === 'in_use' ? 'bg-green-500' :
                                                                            account.status === 'expired' ? 'bg-red-500' :
                                                                                'bg-blue-500'
                                                                )}></span>
                                                                {account.feedbackStatus === 'pending' ? '审核中' : account.statusName}
                                                            </div>
                                                        </div>

                                                        {account.status !== 'in_use' && account.status !== 'expired' && account.feedbackStatus !== 'pending' && (
                                                            <>
                                                                {/* <BaseButton
                                                                    size="sm"
                                                                    onClick={() => handleAutoLogin(account.id)}
                                                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                                                                    leftIcon={<Zap size={14} />}
                                                                >
                                                                    自动登录
                                                                </BaseButton> */}
                                                                <BaseButton
                                                                    size="sm"
                                                                    onClick={() => handleMarkAsUsed(account.id)}
                                                                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all"
                                                                    leftIcon={<CheckCircle size={14} />}
                                                                >
                                                                    标记登录
                                                                </BaseButton>
                                                                <BaseButton
                                                                    size="sm"
                                                                    onClick={() => handleReportInvalid(account.id)}
                                                                    className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all"
                                                                    leftIcon={<AlertTriangle size={14} />}
                                                                >
                                                                    反馈失效
                                                                </BaseButton>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Login Guide */}
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 flex gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg h-fit text-primary dark:text-blue-400">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">快速登录指南</h5>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                        复制账号密码直接登录 Antigravity。如遇 2FA 验证，请直接复制上方动态验证码。登录成功后，别忘了点击"标记登录"以便管理您的账号状态。
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </BaseDialogContent>
        </BaseDialog>
    );
};

export default CardKeyLoginDialog;
