# 安全与隐私说明

## 数据存放位置

所有用户数据均保存在本机：

```
~/Library/Application Support/interview-simulator/
├── settings.json          设置（含 API Key）
├── data/
│   ├── materials/         导入的面试资料
│   ├── resume/            简历
│   ├── schools.json       学校风格笔记
│   ├── history/           面试记录与评分报告
│   ├── models/            语音识别模型
│   ├── venv-whisper/      识别引擎 Python 环境
│   ├── audio/             录音临时文件与 TTS 缓存
│   └── logs/              识别日志
```

## 网络访问

应用仅在以下情况联网，且请求目标由你自行配置：

1. **AI 服务商 API**（你填写的 `baseUrl`）：发送面试对话、资料片段、评分请求；若使用多模态，发送你主动选择的图片。
2. **Edge TTS**（微软在线语音合成）：发送面试官需要朗读的文本（不含你的资料正文）。

除此之外**没有任何外发请求**：无遥测、无统计、无自动更新上报。

## 本地处理

- **语音识别**：faster-whisper 在本机 CPU 推理，录音文件仅在本机临时目录中转，识别后即删除。
- **资料解析**：PDF / Word / Markdown 均在本机解析。

## API Key 安全

- Key 仅以明文保存在本机 `settings.json`，不会上传。
- 若要把本项目**开源或分享**，请确认不要提交 `settings.json`（本仓库 `.gitignore` 已排除相关产物，且该文件位于用户数据目录、不在仓库内）。
- 建议为练习用途单独申请一个 API Key，便于随时吊销。

## 报告问题

如发现安全问题，请通过 GitHub Issues 反馈（请勿在公开 Issue 中粘贴你的 API Key 或个人资料）。
