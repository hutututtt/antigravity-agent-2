import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { AntigravityAccount } from "@/commands/types/account.types.ts";
import { BaseTooltip } from "@/components/base-ui/BaseTooltip.tsx";
import BusinessActionButton from "@/components/business/ActionButton.tsx";
import { BaseButton } from "@/components/base-ui/BaseButton.tsx";
import { Check, Trash2, RefreshCw, Edit2 } from "lucide-react";
import { maskEmail, maskName } from "@/utils/username-masking.ts";
import { cn } from "@/utils/utils.ts";
import { QuotaProgressBar } from "./QuotaProgressBar";
import { LanguageServerResponse } from "@/commands/types/language-server-response.types";
import { AccountCommands } from "@/commands/AccountCommands";
import toast from "react-hot-toast";

interface UserListItemProps {
  user: AntigravityAccount;
  isCurrent: boolean;
  onSelect: (user: AntigravityAccount) => void;
  onSwitch: (email: string) => void;
  onDelete: (email: string) => void;
  quota?: LanguageServerResponse.QuotaInfo;
  allModelsQuota?: Array<{
    label: string;
    quotaInfo: LanguageServerResponse.QuotaInfo;
  }> | null;
  onQuotaRefresh?: (email: string) => void; // 配额刷新回调
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  isCurrent,
  onSelect,
  onSwitch,
  onDelete,
  quota,
  allModelsQuota,
  onQuotaRefresh
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const quotaRef = useRef<HTMLDivElement>(null);

  // 备注编辑状态
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkValue, setRemarkValue] = useState(user.remark || '');
  const [isSavingRemark, setIsSavingRemark] = useState(false);

  // 计算 tooltip 位置
  useEffect(() => {
    if (showTooltip && quotaRef.current) {
      const rect = quotaRef.current.getBoundingClientRect();
      // 向上显示：top = rect.top - tooltipHeight - gap
      // 这里我们先设置为 rect.top - 8，然后在 CSS 中使用 bottom: 100% (相对于 portal 容器) 或者直接计算
      // 由于 Portal 渲染在 body，我们需要绝对坐标 (scrollY)

      // 策略：显示在元素上方
      setTooltipPosition({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2
      });
    }
  }, [showTooltip]);

  const getAvatarUrl = (base64Url: string) => {
    try {
      if (base64Url.startsWith('http') || base64Url.startsWith('data:')) {
        return base64Url;
      }
      return atob(base64Url);
    } catch (error) {
      return '';
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(user.email);
  };

  const handleSaveRemark = async () => {
    if (remarkValue === user.remark) {
      setIsEditingRemark(false);
      return;
    }

    setIsSavingRemark(true);
    try {
      await AccountCommands.updateAccountRemark(user.email, remarkValue);
      toast.success('备注已更新');
      setIsEditingRemark(false);
      // 刷新账户列表
      window.dispatchEvent(new CustomEvent('antigravity_accounts_updated'));
    } catch (error) {
      toast.error(`更新备注失败: ${error}`);
    } finally {
      setIsSavingRemark(false);
    }
  };

  const avatarUrl = getAvatarUrl(user.profile_url);

  return (
    <div
      className={cn(
        "relative group w-full bg-white dark:bg-gray-800 rounded-xl p-4 transition-all duration-200 cursor-pointer",
        isCurrent
          ? "border-2 border-primary shadow-md ring-1 ring-primary/10"
          : "border border-gray-100 dark:border-gray-700 hover:border-secondary hover:shadow-md hover:-translate-y-[2px]"
      )}
      onClick={() => onSelect(user)}
    >
      {/* Current Tag */}
      {isCurrent && (
        <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg z-10">
          当前使用
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Left: Avatar */}
        <div className="relative flex-shrink-0 pt-1">
          <img
            src={avatarUrl}
            alt={user.name}
            className={cn(
              "h-10 w-10 rounded-full object-cover border-2 shadow-sm",
              isCurrent ? "border-primary" : "border-gray-100 dark:border-gray-600"
            )}
          />
        </div>

        {/* Middle: Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex justify-between items-start">
            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate pr-2">
              {maskName(user.name)}
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
            {maskEmail(user.email)}
          </div>

          {/* 备注区域 */}
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            {isEditingRemark ? (
              <input
                type="text"
                value={remarkValue}
                onChange={(e) => setRemarkValue(e.target.value)}
                onBlur={handleSaveRemark}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRemark();
                  if (e.key === 'Escape') {
                    setRemarkValue(user.remark || '');
                    setIsEditingRemark(false);
                  }
                }}
                disabled={isSavingRemark}
                className="w-full text-xs px-2 py-1 border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="添加备注..."
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingRemark(true)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
              >
                <Edit2 className="h-3 w-3" />
                <span className="truncate">{user.remark || '点击添加备注...'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知时间'}
            </span>
          </div>

          {/* Quota Progress - 始终保留空间以保持卡片高度一致 */}
          <div
            ref={quotaRef}
            className="mt-3 w-full min-h-[40px]"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {quota ? (
              <QuotaProgressBar
                quota={quota}
                onQuotaReset={() => onQuotaRefresh?.(user.email)}
              />
            ) : (
              <div className="text-[10px] text-gray-300 dark:text-gray-600 text-center py-2">
                切换账户后显示配额
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 justify-start pt-1">
          {!isCurrent && (
            <>
              <div onClick={(e) => e.stopPropagation()}>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-primary hover:bg-secondary/20 hover:text-primary rounded-md"
                  onClick={() => onSwitch(user.email)}
                  title="切换"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </BaseButton>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-destructive hover:bg-destructive/10 rounded-md"
                  onClick={() => onDelete(user.email)}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </BaseButton>
              </div>
            </>
          )}
          {isCurrent && (
            <div className="h-7 w-7 flex items-center justify-center text-primary">
              <Check className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {/* 使用 Portal 渲染悬浮提示到 body */}
      {showTooltip && allModelsQuota && allModelsQuota.length > 1 && ReactDOM.createPortal(
        <div
          className="fixed z-[99999] w-72 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-blue-200 dark:border-blue-700 pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="text-xs font-semibold mb-3 text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            所有模型配额详情
          </div>
          <div className="space-y-2.5">
            {allModelsQuota.map((model, idx) => {
              const percentage = (model.quotaInfo?.remainingFraction ?? 0) * 100;
              return (
                <div key={idx} className="text-[11px]">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-gray-600 dark:text-gray-300 truncate max-w-[65%] font-medium">{model.label}</span>
                    <span className="text-gray-800 dark:text-gray-100 font-mono font-semibold">{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        percentage < 30 ? "bg-gradient-to-r from-red-500 to-red-600" :
                          percentage < 50 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                            "bg-gradient-to-r from-green-500 to-emerald-500"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* 小三角形指示器 - 指向下方 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white dark:border-t-gray-800"></div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[2px] w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-transparent border-t-blue-200 dark:border-t-blue-700"></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
