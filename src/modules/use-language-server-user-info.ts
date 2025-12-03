import { create } from "zustand";
import { LanguageServerResponse } from "@/commands/types/language-server-response.types.ts";
import type { AntigravityAccount } from "@/commands/types/account.types.ts";
import { LanguageServerCommands } from "@/commands/LanguageServerCommands.ts";

type State = {
  // id -> 用户状态
  users: Record<string, LanguageServerResponse.Root>
}

type Actions = {
  fetchData: (antigravityAccount: AntigravityAccount) => Promise<void>
}

export const useLanguageServerUserInfo = create<State & Actions>((setState, getState) => ({
  users: {},
  fetchData: async (antigravityAccount: AntigravityAccount) => {
    console.log('[LanguageServerUserInfo] Starting fetch for user:', antigravityAccount.email);
    try {
      console.log('[LanguageServerUserInfo] Calling getUserStatus with api_key:', antigravityAccount.api_key?.substring(0, 10) + '...');
      const data = await LanguageServerCommands.getUserStatus(antigravityAccount.api_key)
      console.log('[LanguageServerUserInfo] getUserStatus response:', {
        email: antigravityAccount.email,
        hasUserStatus: !!data?.userStatus,
        hasCascadeModelConfigData: !!data?.userStatus?.cascadeModelConfigData,
        clientModelConfigsCount: data?.userStatus?.cascadeModelConfigData?.clientModelConfigs?.length || 0,
        data: data
      });
      setState({
        users: {
          ...getState().users,
          [antigravityAccount.id]: data
        }
      })
      console.log('[LanguageServerUserInfo] Successfully stored data for user:', antigravityAccount.email);
    } catch (error) {
      console.error(`[LanguageServerUserInfo] Failed to fetch data for user ${antigravityAccount.email}:`, error);
    }
  }
}))
