import { invoke } from '@tauri-apps/api/core';
import type { AntigravityAuthInfo, AntigravityAccount } from './types/account.types';

/**
 * Antigravity 账户管理命令
 */
export class AccountCommands {
  /**
   * 获取当前登录的账户信息
   * @returns 账户认证信息，包含邮箱、数据库路径等
   */
  static async getCurrentInfo(): Promise<AntigravityAuthInfo> {
    return invoke('get_current_antigravity_info');
  }

  /**
   * 获取所有已备份的账户列表
   * @returns 账户列表
   */
  static async getAccounts(): Promise<AntigravityAccount[]> {
    return invoke('get_antigravity_accounts');
  }

  /**
   * 备份当前登录的账户
   * @returns 备份结果消息
   */
  static async backupCurrentAccount(): Promise<string> {
    return invoke('backup_antigravity_current_account');
  }

  /**
   * 恢复账户数据（不包含进程管理）
   * @param accountName 账户名（邮箱）
   * @returns 恢复结果消息
   */
  static async restoreAccount(accountName: string): Promise<string> {
    return invoke('restore_antigravity_account', { account_name: accountName });
  }

  /**
   * 切换到指定账户（完整流程：关闭进程 → 恢复数据 → 重启）
   * @param accountName 账户名（邮箱）
   * @returns 切换结果消息
   */
  static async switchToAccount(accountName: string): Promise<string> {
    return invoke('switch_to_antigravity_account', { account_name: accountName });
  }

  /**
   * 清除所有 Antigravity 数据（注销）
   * @returns 清除结果消息
   */
  static async clearAllData(): Promise<string> {
    return invoke('clear_all_antigravity_data');
  }

  /**
   * 更新账户备注
   * @param email 账户邮箱
   * @param remark 备注内容
   * @returns 更新结果消息
   */
  static async updateAccountRemark(email: string, remark: string): Promise<string> {
    return invoke('update_account_remark', { email, remark });
  }
}
