import React, { useCallback, useEffect, useState } from "react";
import type { AntigravityAccount } from "@/commands/types/account.types.ts";
import BusinessUserDetail from "@/components/business/UserDetail.tsx";
import { useAntigravityAccount, useCurrentAntigravityAccount } from "@/modules/use-antigravity-account.ts";
import { useLanguageServerUserInfo } from "@/modules/use-language-server-user-info";
import { useLanguageServerState } from "@/hooks/use-language-server-state.ts";
import { Trash2, Users, Activity, Cpu } from "lucide-react";

import BusinessConfirmDialog from "@/components/business/ConfirmDialog.tsx";
import toast from 'react-hot-toast';
import { QuotaDashboard } from "@/components/business/QuotaDashboard";
import { UserListItem } from "@/components/business/UserListItem.tsx";
import { maskEmail } from "@/utils/username-masking.ts";
import { useAppGlobalLoader } from "@/modules/use-app-global-loader.ts";
import { useCardExpiration } from "@/hooks/useCardExpiration";
import { AntigravityService } from "@/services/antigravity-service";

export function AppUserPanel() {
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AntigravityAccount | null>(null);
  const antigravityAccount = useAntigravityAccount();
  const languageServerUserInfo = useLanguageServerUserInfo();
  const { isLanguageServerStateInitialized } = useLanguageServerState();
  const currentAntigravityAccount = useCurrentAntigravityAccount();
  const appGlobalLoader = useAppGlobalLoader();
  const { status: cardStatus } = useCardExpiration();

  // 用户详情处理
  const handleUserClick = useCallback((user: AntigravityAccount) => {
    setSelectedUser(user);
    setIsUserDetailOpen(true);
  }, []);

  const handleUserDetailClose = useCallback(() => {
    setIsUserDetailOpen(false);
    setSelectedUser(null);
  }, []);

  // 组件挂载时获取用户列表
  useEffect(() => {
    const loadUsers = async () => {
      try {
        await antigravityAccount.getUsers();
      } catch (error) {
        toast.error(`加载用户失败: ${error}`);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (isLanguageServerStateInitialized) {
      antigravityAccount.users.forEach(user => {
        languageServerUserInfo.fetchData(user)
      })
    }
    antigravityAccount.updateCurrentAccount()
  }, [antigravityAccount.users, isLanguageServerStateInitialized]);

  // 自动备份新登录的账户
  useEffect(() => {
    const { currentAuthInfo, users, insertOrUpdateCurrent } = antigravityAccount;

    // 如果当前有登录用户（有邮箱），但不在备份列表中，且卡密未过期，则自动备份
    if (currentAuthInfo?.email && !users.find(u => u.email === currentAuthInfo.email)) {
      if (cardStatus === 'expired') {
        console.log('[AppUserPanel] 卡密已过期，跳过自动备份');
        return;
      }
      console.log('[AppUserPanel] 检测到新登录账户，正在自动备份...', currentAuthInfo.email);
      insertOrUpdateCurrent().catch(error => {
        console.error('[AppUserPanel] 自动备份失败:', error);
        toast.error('自动备份新账户失败');
      });
    }
  }, [antigravityAccount.currentAuthInfo, antigravityAccount.users, cardStatus]);

  // 获取当前用户的配额数据
  const currentQuotaData = currentAntigravityAccount && languageServerUserInfo.users[currentAntigravityAccount?.id]?.userStatus
    ? languageServerUserInfo.users[currentAntigravityAccount.id].userStatus.cascadeModelConfigData.clientModelConfigs
    : [];

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);

  const handleDeleteBackup = (backupName: string) => {
    setBackupToDelete(backupName);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBackup = async () => {
    if (!backupToDelete) return;

    try {
      await antigravityAccount.delete(backupToDelete);
      toast.success(`备份 "${backupToDelete}" 已删除`);
      setDeleteDialogOpen(false);
      setBackupToDelete(null);
    } catch (error) {
      toast.error(`删除失败: ${error}`);
    }
  };

  const handleSwitchAccount = async (backupName: string) => {
    try {
      appGlobalLoader.open({ label: `正在切换到: ${maskEmail(backupName)}...` });
      await antigravityAccount.switchUser(backupName);
    } finally {
      appGlobalLoader.close();
    }
  };

  const handleClearAllBackups = () => {
    if (antigravityAccount.users.length === 0) {
      toast.error('没有可清除的备份');
      return;
    }
    setIsClearDialogOpen(true);
  };

  const confirmClearAllBackups = async () => {
    try {
      // 使用新的清除并重启逻辑 (不备份)
      await AntigravityService.clearAndRestartAntigravity();

      // 同步前端状态：清空用户列表并更新当前用户信息
      await antigravityAccount.clearAllUsers();
      await antigravityAccount.updateCurrentAccount();

      toast.success('所有数据已清除，应用已重置');
      setIsClearDialogOpen(false);
    } catch (error) {
      toast.error(`清除失败: ${error}`);
    }
  };

  // 轮询更新所有用户的配额信息
  useEffect(() => {
    const fetchAllUsersQuota = () => {
      antigravityAccount.users.forEach(user => {
        languageServerUserInfo.fetchData(user);
      });
    };

    // 初始加载
    if (antigravityAccount.users.length > 0) {
      fetchAllUsersQuota();
    }

    // 每60秒轮询一次
    const intervalId = setInterval(fetchAllUsersQuota, 60000);

    return () => clearInterval(intervalId);
  }, [antigravityAccount.users]);

  return (
    <div className="space-y-8">
      {/* 头部与统计 */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">控制中心</h2>
            <p className="text-gray-500 mt-1 text-sm">系统状态: <span className="text-green-600 font-medium">正常运行</span></p>
          </div>

          {antigravityAccount.users.length > 0 && (
            <button
              onClick={handleClearAllBackups}
              className="text-xs text-red-600 hover:text-red-700 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100"
            >
              <Trash2 className="w-3 h-3" />
              清除所有数据
            </button>
          )}
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 flex items-center gap-4 bg-gradient-to-br from-blue-50 to-white">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{antigravityAccount.users.length}</div>
              <div className="text-xs text-gray-500 font-medium">账户总数</div>
            </div>
          </div>

          <div className="glass-card p-5 flex items-center gap-4 bg-gradient-to-br from-purple-50 to-white">
            <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{currentAntigravityAccount ? '1' : '0'}</div>
              <div className="text-xs text-gray-500 font-medium">活跃会话</div>
            </div>
          </div>

          <div className="glass-card p-5 flex items-center gap-4 bg-gradient-to-br from-green-50 to-white">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-600">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">v1.0</div>
              <div className="text-xs text-gray-500 font-medium">应用版本</div>
            </div>
          </div>
        </div>
      </div>

      {/* 配额仪表板 */}
      {currentQuotaData.length > 0 && (
        <div className="animate-fade-in">
          <div className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            资源配额
          </div>
          <QuotaDashboard models={currentQuotaData} />
        </div>
      )}

      {/* 用户网格 */}
      <div>
        <div className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2">
          账户列表
        </div>

        <div className={`min-h-[200px] ${antigravityAccount.users.length === 0 ? "glass-panel flex items-center justify-center p-12" : ""}`}>
          {antigravityAccount.users.length === 0 ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-700">暂无账户</h3>
              <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                系统数据库为空，请使用卡密登录来初始化新账户。
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {antigravityAccount.users.map((user, index) => {
                // 获取该用户的配额信息
                const userStatus = languageServerUserInfo.users[user.id]?.userStatus;
                const quotaInfo = userStatus?.cascadeModelConfigData?.clientModelConfigs?.[0]?.quotaInfo;

                return (
                  <div key={`${user.email}-${index}`} className="animate-fade-in" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                    <UserListItem
                      user={user}
                      isCurrent={currentAntigravityAccount?.email === user.email}
                      onSelect={handleUserClick}
                      onSwitch={handleSwitchAccount}
                      onDelete={handleDeleteBackup}
                      quota={quotaInfo}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 对话框 */}
      <BusinessConfirmDialog
        isOpen={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        title="确认清除"
        description={`此操作将永久删除 ${antigravityAccount.users.length} 个账户。此操作不可撤销。`}
        onConfirm={confirmClearAllBackups}
        onCancel={() => setIsClearDialogOpen(false)}
        variant="destructive"
        isLoading={false}
        confirmText="清除数据"
      />

      <BusinessConfirmDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description={`确定要永久删除备份 "${backupToDelete}" 吗？`}
        onConfirm={confirmDeleteBackup}
        onCancel={() => setDeleteDialogOpen(false)}
        variant="destructive"
        isLoading={false}
        confirmText="删除"
      />

      <BusinessUserDetail
        isOpen={isUserDetailOpen}
        onOpenChange={handleUserDetailClose}
        user={selectedUser}
      />
    </div>
  );
}
