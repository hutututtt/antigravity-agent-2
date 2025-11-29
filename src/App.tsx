import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppUserPanel } from './AppUserPanel';
import BusinessSettingsDialog from "@/components/business/SettingsDialog.tsx";
import CardKeyLoginDialog from "@/components/CardKeyLoginDialog.tsx";
import { useAntigravityProcess } from "@/hooks/use-antigravity-process.ts";
import BusinessConfirmDialog from './components/business/ConfirmDialog.tsx';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCardKeyLoginOpen, setIsCardKeyLoginOpen] = useState(false);

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

  return (
    <>
      <AppLayout
        sidebar={
          <AppSidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            onCardLogin={() => setIsCardKeyLoginOpen(true)}
            onLoginNew={handleLoginNew}
          />
        }
      >
        {/* 主面板内容 */}
        <AppUserPanel />
      </AppLayout>

      {/* 全局对话框 */}
      <BusinessSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <CardKeyLoginDialog
        isOpen={isCardKeyLoginOpen}
        onOpenChange={setIsCardKeyLoginOpen}
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
