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

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知时间'}
            </span>
          </div>

          {/* Quota Progress */}
          {quota && (
            <div className="mt-3 w-full">
              <QuotaProgressBar quota={quota} />
            </div>
          )}
        </div>

        {/* Right: Actions (Hover Only) */}
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
    </div>
  );
};
