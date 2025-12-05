# Antigravity Agent

<div align="center">

![Antigravity Agent](app-icon.png)

**Antigravity 账号与配置文件管理工具**

一个基于 Tauri 构建的跨平台桌面应用，帮助您轻松管理 Antigravity 账号和备份用户配置文件。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.9-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)

[下载安装](#-下载安装) • [功能特性](#-功能特性) • [开发指南](#-开发指南) • [构建发布](#-构建发布)

</div>

---

## ✨ 功能特性

- 🔐 **账号管理** - 安全管理多个 Antigravity 账号
- 💾 **配置备份** - 一键备份和恢复用户配置文件
- 🚀 **自动更新** - 内置自动更新功能，始终保持最新版本
- 🎨 **现代界面** - 基于 React + TailwindCSS 的精美 UI
- ⚡ **高性能** - Rust 后端 + React 前端，快速响应
- 🌍 **跨平台** - 支持 Windows、macOS、Linux

## 📥 下载安装

### 正式版本

访问 [Releases 页面](https://github.com/hutututtt/-/releases/latest) 下载最新版本：

| 平台 | 下载 | 说明 |
|------|------|------|
| **Windows** | `Antigravity Agent_x.x.x_x64-setup.exe` | 安装版，支持自动更新 |
| **Windows** | `Antigravity-Agent-x86_64-Portable.zip` | 便携版，解压即用 |
| **macOS (Apple Silicon)** | `Antigravity Agent_x.x.x_aarch64.dmg` | M1/M2/M3 芯片 |
| **macOS (Intel)** | `Antigravity Agent_x.x.x_x86_64.dmg` | Intel 芯片 |
| **Linux** | `antigravity-agent_x.x.x_amd64.AppImage` | 通用格式 |
| **Linux (Debian/Ubuntu)** | `antigravity-agent_x.x.x_amd64.deb` | Debian 包 |

### macOS 安装提示

Mac 用户如果遇到"应用已损坏"的提示：

```bash
# 使用终端移除隔离属性
xattr -cr /Applications/Antigravity\ Agent.app
```
