# King办公套件

✨ 轻量高效的办公软件 | 简约 · 浅色 · 活泼

## 📖 项目简介

King办公套件是一款基于 Tauri + React 构建的轻量级办公软件，提供文档编辑、表格处理、演示制作和PDF查看功能。

## 🎯 主要功能

- **📝 文档编辑** - 支持富文本编辑，预设多种字体和格式
- **📊 表格处理** - 单元格编辑，动态添加行列，数据清晰展示
- **📽️ 演示制作** - 幻灯片管理，支持自定义背景颜色
- **📄 PDF查看** - 流畅阅读PDF文档

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 后端框架 | Tauri 2.x (Rust) |
| 加密存储 | AES-256-GCM + Argon2 |
| UI风格 | 简约浅色活泼设计 |

## 📁 项目结构

```
KingOffice/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   │   ├── editors/        # 编辑器组件
│   │   ├── Login.tsx       # 登录页面
│   │   ├── MainInterface.tsx  # 主界面
│   │   ├── SetupWizard.tsx # 安装向导
│   │   └── Toast.tsx       # 消息提示
│   └── styles/             # 样式文件
├── src-tauri/              # Tauri后端 (Rust)
│   └── src/
│       ├── main.rs         # 主入口
│       ├── account.rs       # 账户系统
│       └── logger.rs        # 日志系统
├── dist/                   # 构建输出目录
├── build.ps1              # 构建脚本
└── package.json           # 前端依赖
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Rust 1.70+
- Windows 10/11

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动前端开发服务器
npm run dev

# 在另一个终端启动Tauri
npm run tauri dev
```

### 构建发布

```powershell
# 使用构建脚本（推荐）
.\build.ps1

# 或手动构建
npm run build          # 构建前端
cargo build --release  # 构建后端
```

构建完成后，可执行文件位于 `dist/king-office.exe`

## 📖 使用指南

### 首次启动

1. 运行 `king-office.exe`
2. 按引导设置安装目录和数据存储目录
3. 创建账户或登录

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建文件 |
| Ctrl+O | 打开文件 |
| Ctrl+S | 保存文件 |
| Ctrl+W | 关闭文件 |

### 文件类型

| 扩展名 | 类型 |
|--------|------|
| .doc/.docx | Word文档 |
| .xls/.xlsx | Excel表格 |
| .ppt/.pptx | PowerPoint演示 |
| .pdf | PDF文档 |

## 📝 开发说明

### 添加新功能

1. 在 `src/components/` 添加React组件
2. 在 `src-tauri/src/` 添加Rust命令
3. 更新 `src/components/MainInterface.tsx` 的菜单配置

### 样式规范

使用CSS变量统一管理样式，参考 `src/styles/index.css`:

```css
:root {
  --color-primary: #4F86F7;  /* 主色调 */
  --color-accent: #22C55E;   /* 强调色 */
  --color-bg: #FFFFFF;       /* 背景色 */
  /* ... */
}
```

### 构建发布包

1. 确保 `tauri.conf.json` 中的 `bundle.active` 为 `true`
2. 运行 `cargo build --release`
3. 打包后的文件位于 `src-tauri/target/release/bundle/`

## 🔧 配置说明

软件配置存储在：

- **安装目录** - 应用主程序位置
- **数据目录** - 缓存、日志、临时文件存储位置

首次启动时会显示设置向导，也可随时在应用内修改。

## 📄 许可证

本项目仅供学习交流使用。

## 🙏 致谢

- [Tauri](https://tauri.app/) - 构建工具
- [React](https://react.dev/) - UI框架
- [Vite](https://vitejs.dev/) - 构建工具

---

**King办公套件** - 让办公更简单 ✨
