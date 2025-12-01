# 构建和发布指南

## 自动构建 (GitHub Actions)

### 触发构建

#### 方式 1: 创建版本标签 (推荐)
```bash
# 1. 提交所有更改
git add .
git commit -m "Release v1.0.0"

# 2. 创建版本标签
git tag v1.0.0

# 3. 推送到 GitHub
git push origin main
git push origin v1.0.0
```

GitHub Actions 会自动:
- 构建 Windows (x64) 安装包
- 构建 macOS Universal (Intel + Apple Silicon) 安装包
- 创建 GitHub Release
- 上传所有安装包到 Release

#### 方式 2: 手动触发
1. 访问 GitHub 仓库
2. 点击 `Actions` 标签
3. 选择 `Build Release` workflow
4. 点击 `Run workflow`
5. 选择分支并运行

### 下载构建产物

#### 从 GitHub Release (有版本标签时)
1. 访问 `https://github.com/你的用户名/antigravity-agent/releases`
2. 找到对应版本
3. 下载安装包:
   - `Antigravity-Agent_1.0.0_x64_en-US.msi` - Windows 安装包
   - `Antigravity Agent_1.0.0_universal.dmg` - macOS 安装包

#### 从 Actions Artifacts (手动触发时)
1. 访问 `Actions` 标签
2. 点击对应的 workflow 运行
3. 在 `Artifacts` 部分下载:
   - `Windows-x64` - Windows 安装包
   - `macOS-Universal` - macOS 安装包

---

## 本地构建

### macOS Universal (Intel + Apple Silicon)

```bash
# 1. 安装依赖
npm install

# 2. 添加编译目标
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# 3. 构建
npm run tauri build -- --target universal-apple-darwin

# 输出位置:
# - DMG: src-tauri/target/universal-apple-darwin/release/bundle/dmg/
# - App: src-tauri/target/universal-apple-darwin/release/bundle/macos/
```

### Windows (需要 Windows 机器)

```bash
# 1. 安装依赖
npm install

# 2. 构建
npm run tauri build

# 输出位置:
# - EXE: src-tauri/target/release/bundle/nsis/
# - MSI: src-tauri/target/release/bundle/msi/
```

---

## 版本号管理

版本号在以下文件中定义:
- `src-tauri/tauri.conf.json` - `version` 字段
- `src-tauri/Cargo.toml` - `version` 字段
- `package.json` - `version` 字段

发布新版本前,确保这三个文件的版本号一致。

---

## 故障排查

### 构建失败
1. 检查 Actions 日志
2. 确保所有依赖已安装
3. 验证 Rust 工具链版本

### 无法下载 Release
1. 确保推送了版本标签
2. 检查 GitHub Actions 是否成功运行
3. 验证 `GITHUB_TOKEN` 权限

### macOS 安装包无法打开
- 右键点击 → 打开
- 或在系统设置中允许该应用
