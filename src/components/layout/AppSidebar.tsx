import React from 'react';
import { LayoutDashboard, Key, Settings, Zap, LogOut } from 'lucide-react';
import { cn } from '@/utils/utils';
import { BaseButton } from '@/components/base-ui/BaseButton';

interface AppSidebarProps {
    currentView: 'dashboard' | 'settings';
    onViewChange: (view: 'dashboard' | 'settings') => void;
    onCardLogin: () => void;
    onLoginNew: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    currentView,
    onViewChange,
    onCardLogin,
    onLoginNew
}) => {
    return (
        <div className="w-64 h-screen flex flex-col glass-panel border-r border-gray-200 rounded-none fixed left-0 top-0 z-50">
            {/* 品牌头部 */}
            <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-md">
                    <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">Antigravity</h1>
                    <p className="text-[10px] text-gray-500 font-medium tracking-wide">智能代理 v2.0</p>
                </div>
            </div>

            {/* 导航菜单 */}
            <div className="flex-1 py-8 px-4 space-y-2">
                <div className="text-xs font-bold text-gray-400 px-4 mb-4 uppercase tracking-wider">菜单</div>

                <button
                    onClick={() => onViewChange('dashboard')}
                    className={cn(
                        "nav-link w-full",
                        currentView === 'dashboard' && "active"
                    )}
                >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="font-medium">控制面板</span>
                </button>

                <button
                    onClick={onCardLogin}
                    className="nav-link w-full group"
                >
                    <Key className="w-5 h-5 group-hover:text-secondary transition-colors" />
                    <span className="font-medium">卡密登录</span>
                </button>

                <button
                    onClick={onLoginNew}
                    className="nav-link w-full group"
                >
                    <LogOut className="w-5 h-5 group-hover:text-primary transition-colors" />
                    <span className="font-medium">登录新账户</span>
                </button>

                <button
                    onClick={() => onViewChange('settings')}
                    className={cn(
                        "nav-link w-full",
                        currentView === 'settings' && "active"
                    )}
                >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">系统设置</span>
                </button>
            </div>

            {/* 底部状态 */}
            <div className="p-4 border-t border-gray-200">
                <div className="glass-card p-3 bg-blue-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm animate-pulse"></div>
                        <span className="text-xs text-gray-600 font-medium">系统运行中</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
