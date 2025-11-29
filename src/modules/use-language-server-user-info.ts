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
    try {
      const data = await LanguageServerCommands.getUserStatus(antigravityAccount.api_key)
      setState({
        users: {
          ...getState().users,
          [antigravityAccount.id]: data
        }
      })
    } catch (error) {
      console.error(`[LanguageServerUserInfo] Failed to fetch data for user ${antigravityAccount.email}:`, error);
    }
  }
}))
