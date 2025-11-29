import React from "react";
import { AntigravityAccount } from "@/commands/types/account.types.ts";
import { BaseTooltip } from "@/components/base-ui/BaseTooltip.tsx";
import BusinessActionButton from "@/components/business/ActionButton.tsx";
import { BaseButton } from "@/components/base-ui/BaseButton.tsx";
import { Check, Trash2, RefreshCw } from "lucide-react";
import { maskEmail, maskName } from "@/utils/username-masking.ts";
import { cn } from "@/utils/utils.ts";
import { QuotaProgressBar } from "./QuotaProgressBar";
import { LanguageServerResponse } from "@/commands/types/language-server-response.types";

interface UserListItemProps {
  user: AntigravityAccount;
  isCurrent: boolean;
  onSelect: (user: AntigravityAccount) => void;
  onSwitch: (email: string) => void;
  onDelete: (email: string) => void;
  quota?: LanguageServerResponse.QuotaInfo;
}

export const UserListItem: React.FC<UserListItemProps> = ({
  user,
  isCurrent,
  onSelect,
  onSwitch,
  onDelete,
  quota,
}) => {
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

  const avatarUrl = getAvatarUrl(user.profile_url);

  return (
    <div
      className={cn(
        "relative group h-[120px] w-full bg-white dark:bg-gray-800 rounded-lg p-5 transition-all duration-200 cursor-pointer",
        isCurrent
          ? "border-2 border-primary shadow-md"
          : "border border-gray-100 dark:border-gray-700 hover:border-secondary hover:shadow-md hover:-translate-y-[2px]"
      )}
      onClick={() => onSelect(user)}
    >
      {/* Current Tag */}
      {isCurrent && (
        <div className="absolute top-0 left-0 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-br-lg rounded-tl-md z-10 shadow-sm">
          当前使用
        </div>
      )}

      <div className="flex items-start justify-between h-full">
        {/* Left: Avatar & Info */}
        <div className="flex items-center gap-4 h-full">
          <div className="relative flex-shrink-0">
            <img
              src={avatarUrl}
              alt={user.name}
              className={cn(
                "h-12 w-12 rounded-full object-cover border-2",
                isCurrent ? "border-primary" : "border-gray-200 dark:border-gray-600"
              )}
            />
          </div>

          <div className="flex flex-col justify-center h-full pt-1">
            <div className="font-bold text-gray-900 dark:text-gray-100 text-base truncate max-w-[140px]">
              {maskName(user.name)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate max-w-[140px]">
              {maskEmail(user.email)}
            </div>
            <div className="text-[10px] text-gray-400 mt-auto pt-2">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知时间'}
            </div>

            {/* Quota Progress */}
            {quota && (
              <div className="mt-2 w-[140px]">
                <QuotaProgressBar quota={quota} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions (Hover Only) */}
        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 justify-center h-full">
          {!isCurrent && (
            <>
              <div onClick={(e) => e.stopPropagation()}>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-primary hover:bg-secondary/20 hover:text-primary rounded-md"
                  onClick={() => onSwitch(user.email)}
                  title="切换"
                >
                  <RefreshCw className="h-4 w-4" />
                </BaseButton>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-destructive hover:bg-destructive/10 rounded-md"
                  onClick={() => onDelete(user.email)}
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </BaseButton>
              </div>
            </>
          )}
          {isCurrent && (
            <div className="h-full flex items-center justify-center text-primary">
              <Check className="h-6 w-6" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
