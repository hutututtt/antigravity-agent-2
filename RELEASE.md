# 快速开始 - 自动构建发布

## 前提条件
- ✅ GitHub 账号
- ✅ Git 已安装
- ✅ 代码已推送到 GitHub

## 发布新版本 (3 步)

### 1️⃣ 更新版本号

编辑以下文件,将版本号改为 `1.0.0`:

```bash
# src-tauri/tauri.conf.json
"version": "1.0.0"

# src-tauri/Cargo.toml  
version = "1.0.0"

# package.json
"version": "1.0.0"
```

### 2️⃣ 提交并创建标签

```bash
cd antigravity-agent

# 提交更改
git add .
git commit -m "Release v1.0.0"

# 创建版本标签
git tag v1.0.0

# 推送到 GitHub
git push origin main
git push origin v1.0.0
```

### 3️⃣ 等待构建完成

1. 访问 GitHub 仓库的 `Actions` 标签
2. 等待 `Build Release` workflow 完成 (~10-15分钟)
3. 访问 `Releases` 页面
4. 下载安装包:
   - **Windows**: `Antigravity-Agent_1.0.0_x64_en-US.msi`
   - **macOS**: `Antigravity Agent_1.0.0_universal.dmg`

---

## 如果还没有 GitHub 仓库

### 创建仓库

1. 访问 https://github.com/new
2. 仓库名: `antigravity-agent`
3. 选择 `Private` 或 `Public`
4. 点击 `Create repository`

### 推送代码

```bash
cd antigravity-agent

# 初始化 Git (如果还没有)
git init

# 添加远程仓库 (替换成你的用户名)
git remote add origin https://github.com/你的用户名/antigravity-agent.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 推送到 GitHub
git branch -M main
git push -u origin main
```

然后按照上面的"发布新版本"步骤操作。

---

## 手动触发构建 (不创建 Release)

1. 访问 GitHub 仓库
2. 点击 `Actions` 标签
3. 选择 `Build Release`
4. 点击 `Run workflow` → `Run workflow`
5. 等待完成后,在 `Artifacts` 下载安装包

---

## 常见问题

**Q: 构建失败怎么办?**
A: 点击失败的 workflow,查看日志找出错误原因

**Q: 如何修改应用名称?**
A: 编辑 `src-tauri/tauri.conf.json` 中的 `productName`

**Q: 如何添加应用图标?**
A: 替换 `src-tauri/icons/` 目录下的图标文件

**Q: 构建产物在哪里?**
A: 
- GitHub Release (有标签时)
- Actions Artifacts (手动触发时)
