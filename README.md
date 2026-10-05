# 面试模拟器（Interview Simulator）

> 研究生复试 / 保研面试的**本地 AI 模拟面试**桌面应用：四阶段全程语音对话，基于你自己的资料出题，支持目标院校风格调控，面试结束自动生成评分报告与参考答案。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon)-lightgrey)

---

## ✨ 功能特性

| 模块 | 说明 |
|---|---|
| 🗣️ **四阶段模拟面试** | 自我介绍（计时）→ 英语口语 → 专业课 → 简历提问，像真实面试一样推进 |
| 🎙️ **全程语音对话** | 本地 Whisper 语音识别（边说边出字）+ Edge TTS 面试官朗读，无需键盘 |
| 📚 **资料驱动出题** | 导入你的英语资料 / 专业课资料 / 简历（PDF / Word / Markdown / TXT），AI 基于这些内容出题 |
| 🏫 **目标院校风格** | 录入你搜集的各校面试风格与真题回忆，面试官尽量贴合该校真实风格 |
| 🎭 **面试官风格可调** | 温和引导 / 标准 / 压力型 / 学术深挖 4 种预设 + 追问深度、英语难度、压力程度滑块 |
| 🤖 **多模型支持** | 可配置多个 OpenAI 兼容服务商（DeepSeek、通义千问、智谱、Kimi、OpenAI、本地 Ollama…），支持**多模态模型看图** |
| 📊 **评分报告** | 面试后分环节打分（16 项维度）+ 总评 + 改进建议 + 问答回放，可导出 Markdown |
| 💡 **参考答案** | 面试结束后为每道题生成答题要点与参考答案（面试过程中不会提前透露答案） |
| 🕘 **历史与对比** | 保存每次练习记录，可对比两次得分变化 |
| 🔒 **隐私优先** | 资料、录音、报告全部本地存储；仅 AI 对话与语音合成需要联网 |

---

## 🚀 快速开始（用户）

### 安装

1. 下载 Release 中的 `面试模拟器-*.dmg`
2. 拖入「应用程序」文件夹
3. 首次打开：**右键 → 打开**（应用未签名，属正常提示）

### 首次配置

| 步骤 | 操作 |
|---|---|
| 1️⃣ AI 服务商 | 设置页 → AI 服务商 → 选用 DeepSeek（或通义/智谱等），填入 API Key |
| 2️⃣ 语音识别 | 设置页 → 语音识别 → 安装识别引擎 → 下载语音模型（约 464MB，一次性） |
| 3️⃣ 麦克风 | 系统设置 → 隐私与安全性 → 麦克风，允许「面试模拟器」 |
| 4️⃣ 导入资料 | 资料库页 → 分别导入英语资料 / 专业课资料 / 简历 |

### 开始练习

设置页调好面试参数与风格 → 模拟面试页选目标学校 → 🚀 开始面试。

---

## 🛠 开发

### 环境要求

- macOS（Apple Silicon）+ Node.js ≥ 22
- Python 3（语音识别引擎会在应用内自动创建独立虚拟环境，不污染系统）

### 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热更新）
npm run typecheck    # 类型检查
npm run build        # 构建
npm run build:mac    # 打包 dmg（产物在 dist/）
```

> 国内网络建议保留仓库内 `.npmrc`（Electron 二进制走国内镜像）。

### 技术栈

Electron 43 · electron-vite 5 · React 19 · TypeScript 5.9 · Vite 7
DeepSeek 等 OpenAI 兼容 API · faster-whisper（本地识别）· Edge TTS（语音合成）

### 项目结构

```
src/
├── main/        # 主进程：AI 对话、语音识别、TTS、资料解析、存储
├── preload/     # 安全桥接
├── renderer/    # React 界面（各功能页面）
└── shared/      # 共享类型
docs/
├── PRD.md       # 需求文档
└── 开发指南.md   # 修改与重新打包指南
```

---

## 🔒 隐私说明

- **数据全本地**：面试资料、录音、评分报告、历史记录保存在
  `~/Library/Application Support/interview-simulator/`，不会上传到任何服务器。
- **联网仅有**：① 与你自己配置的 AI 服务商通信（面试对话、评分）；② Edge TTS 语音合成。
- **语音识别本地运行**：Whisper 模型在本机推理，音频不出本机。
- **无遥测**：不收集任何使用数据、不接入统计 SDK。

详见 [SECURITY.md](SECURITY.md)。

---

## 📄 开源协议

[MIT](LICENSE) © 2026 YOUR_GITHUB_USERNAME

---

## ⚠️ 免责声明

本项目为学习与模拟练习工具，面试评分与参考答案由 AI 生成，仅供参考，不代表任何院校的真实评价标准。
