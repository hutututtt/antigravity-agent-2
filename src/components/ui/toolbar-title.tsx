import React from 'react';
import UpdateBadge from '../UpdateBadge';
import { UpdateState, DownloadProgress } from '../../services/updateService';

interface ToolbarTitleProps {
  className?: string;
  updateState?: UpdateState;
  downloadProgress?: DownloadProgress | null;
  onUpdateClick?: () => void;
}

const ToolbarTitle: React.FC<ToolbarTitleProps> = ({
  className = '',
  updateState = 'no-update',
  downloadProgress = null,
  onUpdateClick,
}) => {
  return (
    <div className="relative inline-block">
      <h1 className={`border-t toolbar-title text-2xl font-bold m-0 bg-gradient-to-r from-antigravity-blue to-purple-600 bg-clip-text text-transparent flex items-center gap-2 ${className}`}>
        {/* Antigravity Agent */}
      </h1>

      {/* 更新徽章 */}
      {/* <UpdateBadge
        state={updateState}
        progress={downloadProgress}
        onClick={onUpdateClick}
      /> */}
    </div>
  );
};

export default ToolbarTitle;