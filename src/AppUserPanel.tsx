import React, { useCallback, useEffect, useState } from "react";
import type { AntigravityAccount } from "@/commands/types/account.types.ts";
import BusinessUserDetail from "@/components/business/UserDetail.tsx";
import { useAntigravityAccount, useCurrentAntigravityAccount } from "@/modules/use-antigravity-account.ts";
import { useLanguageServerUserInfo } from "@/modules/use-language-server-user-info";
import { useLanguageServerState } from "@/hooks/use-language-server-state.ts";
import { Trash2, Users, Activity, Shield, Play } from "lucide-react";
import { ProcessCommands } from "@/commands/ProcessCommands.ts";

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
    if (isLanguageServerStateInitialized && currentAntigravityAccount) {
      // 当切换到新账户时，获取该账户的配额信息并缓存
      languageServerUserInfo.fetchData(currentAntigravityAccount);
    }
    antigravityAccount.updateCurrentAccount()
  }, [currentAntigravityAccount?.id, isLanguageServerStateInitialized]);

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

  // 监听账户更新事件（例如备注更新）
  useEffect(() => {
    const handleAccountsUpdated = () => {
      // 刷新账户列表
      antigravityAccount.getUsers();
    };

    window.addEventListener('antigravity_accounts_updated', handleAccountsUpdated);
    return () => {
      window.removeEventListener('antigravity_accounts_updated', handleAccountsUpdated);
    };
  }, []);

  // 获取当前用户的配额数据
  const currentQuotaData = React.useMemo(() => {
    if (!currentAntigravityAccount) {
      return [];
    }
    const userInfo = languageServerUserInfo.users[currentAntigravityAccount.email];
    if (!userInfo?.userStatus?.cascadeModelConfigData?.clientModelConfigs) {
      return [];
    }
    const configs = userInfo.userStatus.cascadeModelConfigData.clientModelConfigs;
    // 按标签字母顺序排序，确保显示顺序一致
    return [...configs].sort((a, b) => a.label.localeCompare(b.label));
  }, [currentAntigravityAccount?.email, languageServerUserInfo.users[currentAntigravityAccount?.email || '']]);

  console.log('[AppUserPanel] Quota data check:', {
    hasCurrentAccount: !!currentAntigravityAccount,
    currentAccountEmail: currentAntigravityAccount?.email,
    userInfoForCurrentAccount: languageServerUserInfo.users[currentAntigravityAccount?.email || ''],
    hasUserInfo: !!languageServerUserInfo.users[currentAntigravityAccount?.email || ''],
    hasUserStatus: !!languageServerUserInfo.users[currentAntigravityAccount?.email || '']?.userStatus,
    hasCascadeModelConfigData: !!languageServerUserInfo.users[currentAntigravityAccount?.email || '']?.userStatus?.cascadeModelConfigData,
    quotaDataLength: currentQuotaData.length,
    quotaData: currentQuotaData,
    allCachedEmails: Object.keys(languageServerUserInfo.users)
  });


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

      // 切换成功后，开始轮询获取新账户的配额
      // 因为后端切换可能需要时间，如果获取到的数据不匹配（fetchData返回false），则重试
      const checkQuota = async (retryCount = 0) => {
        const maxRetries = 5;
        const newCurrentAccount = antigravityAccount.users.find(u => u.email === backupName);

        if (!newCurrentAccount) return;

        console.log(`[AppUserPanel] Fetching quota attempt ${retryCount + 1}/${maxRetries} for:`, newCurrentAccount.email);
        const success = await languageServerUserInfo.fetchData(newCurrentAccount);

        if (!success && retryCount < maxRetries) {
          console.log(`[AppUserPanel] Fetch failed or mismatch, retrying in 2s...`);
          setTimeout(() => checkQuota(retryCount + 1), 2000);
        } else if (success) {
          console.log(`[AppUserPanel] Successfully fetched quota for:`, newCurrentAccount.email);
        } else {
          console.warn(`[AppUserPanel] Failed to fetch quota after ${maxRetries} attempts`);
        }
      };

      // 首次延迟 1 秒开始尝试
      setTimeout(() => checkQuota(), 1000);
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

  // 处理配额刷新（当倒计时结束时）
  const handleQuotaRefresh = (email: string) => {
    console.log(`[AppUserPanel] Quota reset detected for ${email}, updating cache...`);

    // 直接修改缓存中的配额数据
    const cachedData = languageServerUserInfo.users[email];
    if (cachedData?.userStatus?.cascadeModelConfigData?.clientModelConfigs) {
      const updatedConfigs = cachedData.userStatus.cascadeModelConfigData.clientModelConfigs.map(config => ({
        ...config,
        quotaInfo: {
          ...config.quotaInfo,
          remainingFraction: 1.0 // 恢复到 100%
        }
      }));

      // 更新缓存
      languageServerUserInfo.users[email] = {
        ...cachedData,
        userStatus: {
          ...cachedData.userStatus,
          cascadeModelConfigData: {
            ...cachedData.userStatus.cascadeModelConfigData,
            clientModelConfigs: updatedConfigs
          }
        }
      };

      console.log(`[AppUserPanel] Cache updated for ${email}, quota reset to 100%`);
    }
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

  const [isStartingAntigravity, setIsStartingAntigravity] = useState(false);

  const handleStartAntigravity = async () => {
    setIsStartingAntigravity(true);
    try {
      const result = await ProcessCommands.start();
      toast.success(result || 'Antigravity 已启动');

      // 等待 2 秒后重新尝试获取当前账户的配额
      setTimeout(() => {
        if (currentAntigravityAccount) {
          languageServerUserInfo.fetchData(currentAntigravityAccount);
        }
      }, 2000);
    } catch (error) {
      toast.error(`启动失败: ${error}`);
    } finally {
      setIsStartingAntigravity(false);
    }
  };


  // 轮询更新当前用户的配额信息（带失败保护）
  useEffect(() => {
    let failureCount = 0;
    const MAX_FAILURES = 3; // 连续失败3次后停止轮询
    let intervalId: NodeJS.Timeout | null = null; // Declare intervalId here

    const fetchCurrentUserQuota = async () => {
      if (currentAntigravityAccount) {
        try {
          const success = await languageServerUserInfo.fetchData(currentAntigravityAccount);
          if (success) {
            failureCount = 0; // 成功后重置失败计数
          } else {
            failureCount++;
            console.warn(`[AppUserPanel] 配额获取失败 (${failureCount}/${MAX_FAILURES})`);
          }
        } catch (error) {
          failureCount++;
          console.error(`[AppUserPanel] 配额获取异常 (${failureCount}/${MAX_FAILURES}):`, error);
        }

        // 如果连续失败次数过多，停止轮询
        if (failureCount >= MAX_FAILURES) {
          console.warn('[AppUserPanel] 配额获取连续失败，停止轮询。请检查 Antigravity Language Server 是否正常运行。');
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null; // Clear it to prevent further attempts to clear
          }
        }
      }
    };

    // 初始加载（延迟2秒，避免启动时的竞争）
    let initialTimeout: NodeJS.Timeout | null = null;
    if (currentAntigravityAccount) {
      initialTimeout = setTimeout(() => {
        fetchCurrentUserQuota();
      }, 2000);
    }

    // 每60秒轮询一次
    intervalId = setInterval(fetchCurrentUserQuota, 60000);

    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentAntigravityAccount?.id]);

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

        {/* 统计卡片 - 紧凑版 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-800/50 rounded-lg">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{antigravityAccount.users.length}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">账户总数</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-800/50 rounded-lg">
                <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{currentAntigravityAccount ? '1' : '0'}</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">活跃会话</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 dark:bg-green-800/50 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">v1.0.0</p>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">应用版本</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 配额仪表板 */}
      {currentAntigravityAccount ? (
        currentQuotaData.length > 0 ? (
          <div className="animate-fade-in">
            <div className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
              资源配额
            </div>
            <QuotaDashboard models={currentQuotaData} />
          </div>
        ) : (
          <div className="glass-panel p-6 text-center">
            <div className="text-sm text-gray-500">
              <div className="animate-pulse">正在加载配额信息...</div>
              <div className="text-xs text-gray-400 mt-2">
                请确保 Antigravity Language Server 正在运行
              </div>
            </div>
          </div>
        )
      ) : null}


      {/* 用户网格 */}
      <div>
        <div className="text-sm font-bold text-gray-600 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">账户列表</span>
          <button
            onClick={() => {
              // 刷新整个页面
              window.location.reload();
            }}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <Activity className="w-3.5 h-3.5" />
            刷新页面
          </button>
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
            <div className="">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 pb-2 overflow-visible">
                {antigravityAccount.users.map((user, index) => {
                  const isCurrent = currentAntigravityAccount?.email === user.email;

                  // 获取该用户的配额信息（从缓存中，使用 email 作为 key）
                  // 注意：非当前账户的配额可能不是最新的
                  const userStatus = languageServerUserInfo.users[user.email]?.userStatus;
                  const clientModelConfigs = userStatus?.cascadeModelConfigData?.clientModelConfigs;

                  // 调试日志
                  console.log(`[AppUserPanel] User ${user.email}:`, {
                    email: user.email,
                    isCurrent,
                    hasUserStatus: !!userStatus,
                    hasClientModelConfigs: !!clientModelConfigs,
                    configsCount: clientModelConfigs?.length || 0,
                    allCachedEmails: Object.keys(languageServerUserInfo.users)
                  });

                  let quotaInfo = null;
                  let allModelsQuota = null;

                  if (clientModelConfigs && clientModelConfigs.length > 0) {
                    // 选择配额信息的策略：显示剩余配额最少的模型
                    // 这样用户可以知道最紧张的配额情况
                    const sortedByQuota = [...clientModelConfigs].sort((a, b) => {
                      const aFraction = a.quotaInfo?.remainingFraction ?? 1;
                      const bFraction = b.quotaInfo?.remainingFraction ?? 1;
                      return aFraction - bFraction; // 升序，最少的在前面
                    });

                    quotaInfo = sortedByQuota[0]?.quotaInfo;

                    // 传递所有模型的配额信息用于悬浮显示
                    allModelsQuota = clientModelConfigs.map(config => ({
                      label: config.label,
                      quotaInfo: config.quotaInfo
                    }));

                    console.log(`[AppUserPanel] User ${user.email} quotaInfo:`, quotaInfo);
                  }

                  return (
                    <div key={`${user.email}-${index}`} className="animate-fade-in" style={{ animationDelay: `${0.05 * (index + 1)}s` }}>
                      <UserListItem
                        user={user}
                        isCurrent={isCurrent}
                        onSelect={handleUserClick}
                        onSwitch={handleSwitchAccount}
                        onDelete={handleDeleteBackup}
                        quota={quotaInfo}
                        allModelsQuota={allModelsQuota}
                        onQuotaRefresh={handleQuotaRefresh}
                      />
                    </div>
                  );
                })}
              </div>
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
