import React, { useCallback, useState } from 'react';
import { Download, Plus, Upload, Key, Settings, Zap } from 'lucide-react';
import BusinessUpdateDialog from './components/business/UpdateDialog.tsx';
import BusinessConfirmDialog from './components/business/ConfirmDialog.tsx';
import BusinessActionButton from './components/business/ActionButton.tsx';
import ToolbarTitle from './components/ui/toolbar-title.tsx';
import { useUpdateChecker } from './hooks/useUpdateChecker.ts';
import { useAntigravityAccount } from '@/modules/use-antigravity-account.ts';
import { logger } from './utils/logger.ts';
import toast from 'react-hot-toast';
import { useImportExportAccount } from "@/modules/use-import-export-accounts.ts";
import { useAntigravityProcess } from "@/hooks/use-antigravity-process.ts";
import ImportPasswordDialog from "@/components/ImportPasswordDialog.tsx";
import ExportPasswordDialog from "@/components/ExportPasswordDialog.tsx";
import BusinessSettingsDialog from "@/components/business/SettingsDialog.tsx";
import CardKeyLoginDialog from "@/components/CardKeyLoginDialog.tsx";
import { BaseButton } from '@/components/base-ui/BaseButton';

const AppToolbar = () => {

  // ========== 应用状态 ==========
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCardKeyLoginOpen, setIsCardKeyLoginOpen] = useState(false);


  const antigravityAccount = useAntigravityAccount();
  const importExportAccount = useImportExportAccount();
  // 使用单独的选择器避免无限循环
  const isImporting = useImportExportAccount((state) => state.isImporting);
  const isExporting = useImportExportAccount((state) => state.isExporting);
  const isCheckingData = useImportExportAccount((state) => state.isCheckingData);
  const importDialogIsOpen = useImportExportAccount((state) => state.importDialogIsOpen);
  const exportDialogIsOpen = useImportExportAccount((state) => state.exportDialogIsOpen);

  // 处理导入对话框取消
  const handleImportDialogCancel = useCallback(() => {
    importExportAccount.closeImportDialog();
    toast.error('操作已取消');
  }, [importExportAccount]);

  // 处理导出对话框取消
  const handleExportDialogCancel = useCallback(() => {
    importExportAccount.closeExportDialog();
    toast.error('操作已取消');
  }, [importExportAccount]);

  // 包装方法以刷新用户列表
  const handleImportConfig = () => {
    importExportAccount.importConfig()
  };
  const handleExportConfig = () => importExportAccount.exportConfig();

  // 进程管理
  const { isProcessLoading, backupAndRestartAntigravity } = useAntigravityProcess();

  // 计算全局加载状态
  const isAnyLoading = isProcessLoading || isImporting || isExporting;

  // 确认对话框状态（用于"登录新账户"操作）
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => { }
  });


  // 处理登录新账户按钮点击
  const handleBackupAndRestartClick = () => {
    logger.info('用户点击登录新账户按钮，显示确认对话框', {
      module: 'AppToolbar',
      action: 'backup_and_restart_click'
    });

    setConfirmDialog({
      isOpen: true,
      title: '登录新账户',
      description: `确定要关闭 Antigravity 并登录新账户吗？

此操作将会：
1. 关闭所有 Antigravity 进程
2. 自动备份当前账户信息
3. 清除 Antigravity 用户信息
4. 自动重新启动 Antigravity

登录新账户后点击 "刷新" 即可保存新账户
注意：系统将自动启动 Antigravity，请确保已保存所有重要工作`,
      onConfirm: async () => {
        logger.info('用户确认登录新账户操作', {
          module: 'AppToolbar',
          action: 'backup_and_restart_confirmed'
        });
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        backupAndRestartAntigravity();
      }
    });
  };

  // 使用自动更新检查 Hook
  const {
    updateState,
    updateInfo,
    downloadProgress,
    error: updateError,
    startDownload,
    installAndRelaunch,
    dismissUpdate,
  } = useUpdateChecker(true); // 启用自动检查

  // 更新对话框状态
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  // 处理更新徽章点击
  const handleUpdateBadgeClick = () => {
    setIsUpdateDialogOpen(true);
  };

  // 处理开始下载
  const handleStartDownload = async () => {
    try {
      await startDownload();
      toast.success('更新包下载完成，点击重启按钮安装');
    } catch (error) {
      // 只在控制台打印错误，不提示用户
      logger.error('下载失败', {
        module: 'AppToolbar',
        action: 'download_update_failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 处理安装并重启
  const handleInstallAndRelaunch = async () => {
    try {
      toast('正在安装更新并重启应用...');
      await installAndRelaunch();
      // 如果成功，应用会重启，这里的代码不会执行
    } catch (error) {
      // 只在控制台打印错误，不提示用户
      logger.error('安装失败', {
        module: 'AppToolbar',
        action: 'install_update_failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleSubmitImportPassword = (password: string) => {
    importExportAccount.submitImportPassword(password)
      .then(() => {
        antigravityAccount.getUsers()
      })
  };


  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50 flex items-center justify-between px-6 shadow-sm">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-lg font-bold text-primary dark:text-white tracking-tight">
            Antigravity Agent
          </h1>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>
          <ToolbarTitle
            updateState={updateState}
            downloadProgress={downloadProgress}
            onUpdateClick={handleUpdateBadgeClick}
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <BusinessActionButton
            onClick={() => setIsCardKeyLoginOpen(true)}
            variant="default"
            icon={<Key className="h-4 w-4" />}
            tooltip="使用卡密登录并管理账号"
            isLoading={false}
            loadingText=""
            isAnyLoading={isAnyLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white border-none shadow-sm h-9 px-4 rounded-md text-sm font-medium transition-colors"
          >
            卡密登录
          </BusinessActionButton>

          <BusinessActionButton
            onClick={handleBackupAndRestartClick}
            variant="default"
            icon={<Plus className="h-4 w-4" />}
            tooltip="关闭 Antigravity，备份当前用户，清除用户信息，并自动重新启动"
            isLoading={isProcessLoading}
            loadingText="处理中..."
            isAnyLoading={isAnyLoading}
            className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 shadow-sm h-9 px-4 rounded-md text-sm font-medium transition-colors"
          >
            登录新账户
          </BusinessActionButton>

          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700 ml-2">
            <BusinessActionButton
              onClick={handleImportConfig}
              variant="ghost"
              icon={<Upload className="h-4 w-4" />}
              tooltip="导入配置"
              isLoading={isImporting}
              loadingText=""
              isAnyLoading={isAnyLoading}
              className="h-8 w-8 p-0 text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-700 rounded-md"
            >
              {''}
            </BusinessActionButton>

            <BusinessActionButton
              onClick={handleExportConfig}
              variant="ghost"
              icon={<Download className="h-4 w-4" />}
              tooltip="导出配置"
              disabled={antigravityAccount.users.length === 0}
              isLoading={isExporting || isCheckingData}
              loadingText=""
              isAnyLoading={isAnyLoading}
              className="h-8 w-8 p-0 text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-700 rounded-md"
            >
              {''}
            </BusinessActionButton>
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <BaseButton
            onClick={() => setIsSettingsOpen(true)}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </BaseButton>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[60px]"></div>

      {/* 确认对话框 */}
      <BusinessConfirmDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => {
          logger.info('用户取消了登录新账户操作', {
            module: 'AppToolbar',
            action: 'backup_and_restart_cancelled'
          });
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
      />


      {/* 更新对话框 */}
      <BusinessUpdateDialog
        isOpen={isUpdateDialogOpen}
        onClose={() => setIsUpdateDialogOpen(false)}
        state={updateState}
        updateInfo={updateInfo}
        progress={downloadProgress}
        error={updateError}
        onDownload={handleStartDownload}
        onInstall={handleInstallAndRelaunch}
        onDismiss={() => {
          dismissUpdate();
          setIsUpdateDialogOpen(false);
        }}
      />

      <ImportPasswordDialog
        isOpen={importDialogIsOpen}
        onSubmit={handleSubmitImportPassword}
        onCancel={handleImportDialogCancel}
        onOpenChange={(open) => !open && importExportAccount.closeImportDialog()}
      />

      <ExportPasswordDialog
        isOpen={exportDialogIsOpen}
        onSubmit={importExportAccount.submitExportPassword}
        onCancel={handleExportDialogCancel}
        onOpenChange={(open) => !open && importExportAccount.closeExportDialog()}
      />

      <BusinessSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <CardKeyLoginDialog
        isOpen={isCardKeyLoginOpen}
        onOpenChange={setIsCardKeyLoginOpen}
      />
    </>
  );
};

export default AppToolbar;
