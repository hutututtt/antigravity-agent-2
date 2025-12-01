import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppUserPanel } from './AppUserPanel';
import BusinessSettingsDialog from "@/components/business/SettingsDialog.tsx";
import CardKeyLoginDialog from "@/components/CardKeyLoginDialog.tsx";
import { useAntigravityProcess } from "@/hooks/use-antigravity-process.ts";
import BusinessConfirmDialog from './components/business/ConfirmDialog.tsx';
import NetworkCheckDialog from "@/components/business/NetworkCheckDialog.tsx";
import { useCardExpiration } from '@/hooks/useCardExpiration';
import ExpirationBanner from '@/components/business/ExpirationBanner';
import AppToolbar from './AppToolbar';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCardKeyLoginOpen, setIsCardKeyLoginOpen] = useState(false);
  const [isNetworkCheckOpen, setIsNetworkCheckOpen] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [isImportExportVisible, setIsImportExportVisible] = useState(false);

  const { status: cardStatus, daysLeft, checkExpiration } = useCardExpiration();

  // Re-check expiration when card key dialog closes (user might have renewed)
  useEffect(() => {
    if (!isCardKeyLoginOpen) {
      checkExpiration();
    }
  }, [isCardKeyLoginOpen]);

  // Enforce mandatory login
  useEffect(() => {
    if (cardStatus === 'no_card') {
      setIsCardKeyLoginOpen(true);
    }
  }, [cardStatus]);

  // 进程管理
  const { backupAndRestartAntigravity } = useAntigravityProcess();
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

  const handleLoginNew = () => {
    setConfirmDialog({
      isOpen: true,
      title: '重启代理',
      description: '确定要备份当前数据并重启 Antigravity 吗？',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        backupAndRestartAntigravity();
      }
    });
  };

  const handleViewChange = (view: 'dashboard' | 'settings') => {
    if (view === 'settings') {
      setIsSettingsOpen(true);
    } else {
      setCurrentView(view);
    }
  };

  const handleToggleImportExport = () => {
    setIsImportExportVisible(prev => {
      const newState = !prev;
      if (newState) {
        toast.success('已开启高级功能：导入/导出');
      } else {
        toast.success('已关闭高级功能');
      }
      return newState;
    });
  };

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden">
        {isBannerVisible && cardStatus === 'expired' && (
          <ExpirationBanner
            status={cardStatus}
            daysLeft={daysLeft}
            onRenew={() => setIsCardKeyLoginOpen(true)}
            onClose={() => setIsBannerVisible(false)}
          />
        )}
        <AppToolbar showImportExport={isImportExportVisible} />
        <div className="flex-1 overflow-hidden">
          <AppLayout
            sidebar={
              <AppSidebar
                currentView={currentView}
                onViewChange={handleViewChange}
                onCardLogin={() => setIsCardKeyLoginOpen(true)}
                onLoginNew={handleLoginNew}
                onNetworkCheck={() => setIsNetworkCheckOpen(true)}
                cardStatus={cardStatus}
                onToggleImportExport={handleToggleImportExport}
              />
            }
          >
            <AppUserPanel />
          </AppLayout>
        </div>
      </div>

      {/* 全局对话框 */}
      <BusinessSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
      <CardKeyLoginDialog
        isOpen={isCardKeyLoginOpen}
        onOpenChange={(open) => {
          // Prevent closing if no card is present
          if (!open && cardStatus === 'no_card') {
            return;
          }
          setIsCardKeyLoginOpen(open);
        }}
      />

      <NetworkCheckDialog
        isOpen={isNetworkCheckOpen}
        onOpenChange={setIsNetworkCheckOpen}
      />

      <BusinessConfirmDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!bg-white !text-gray-900 !border !border-gray-200 !shadow-lg',
          style: {
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #e5e7eb'
          }
        }}
      />
    </>
  );
}

export default App;
