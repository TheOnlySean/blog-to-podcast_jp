# MiniMax-MCP 集成设置指南

本项目现已集成官方 [MiniMax-MCP-JS](https://github.com/MiniMax-AI/MiniMax-MCP-JS) 的实现方法，提供更稳定、更官方的语音合成服务。

## 🔑 API 密钥配置

### 重要提醒
**⚠️ API主机和密钥必须匹配区域，否则会出现 `Invalid API key` 错误。**

| 区域 | API 密钥获取 | API 主机 |
|------|-------------|----------|
| 全球版 | [MiniMax Global](https://www.minimax.io/platform/user-center/basic-information/interface-key) | `https://api.minimaxi.io` |

## 🛠️ Vercel 环境变量设置

在 Vercel 项目设置中添加以下环境变量：

```bash
# OpenAI API Key (用于脚本生成)
OPENAI_API_KEY=your_openai_api_key_here

# MiniMax API Key (用于语音合成)
MINIMAX_API_KEY=your_minimax_api_key_here

# MiniMax API Host (全球版)
MINIMAX_API_HOST=https://api.minimax.io
```

## 🎯 支持的功能

### 文本转语音 (Text-to-Audio)
- **模型**: `speech-02-hd` (最新高质量模型)
- **语音选项**:
  - `female`: 女性日语语音 (`female-shaonv`)
  - `male`: 男性日语语音 (`male-qn-qingse`)
- **语言增强**: 自动日语优化 (`languageBoost: 'ja'`)
- **音频格式**: MP3, 32kHz, 128kbps

### 参数配置
```javascript
{
  text: "您的日语文本",
  model: "speech-02-hd",
  voiceId: "female-shaonv", // 或 "male-qn-qingse"
  speed: 1.0,              // 语速 (0.5-2.0)
  vol: 1.0,                // 音量 (0.1-10.0)
  pitch: 0,                // 音调 (-12 到 12)
  emotion: "neutral",      // 情感
  format: "mp3",           // 音频格式
  sampleRate: 32000,       // 采样率
  bitrate: 128000,         // 比特率
  channel: 1,              // 声道数
  languageBoost: "ja",     // 日语增强
  stream: false            // 非流式输出
}
```

## 🚀 部署步骤

1. **克隆项目**
   ```bash
   git clone <your-repo-url>
   cd japanese_podcast_agent/vercel-deploy
   ```

2. **配置环境变量**
   - 在 Vercel 项目设置中添加上述环境变量
   - 确保 API 密钥和主机地址匹配

3. **部署到 Vercel**
   ```bash
   git add .
   git commit -m "集成MiniMax-MCP官方实现"
   git push origin main
   ```

## 🔧 故障排除

### 1. Invalid API Key 错误
- 确认 `MINIMAX_API_KEY` 和 `MINIMAX_API_HOST` 匹配
- 全球版用户使用: `https://api.minimax.io`

### 2. 语音生成失败
- 检查文本长度（建议 1500-2500 字符）
- 确认选择的语音ID有效
- 查看 Vercel 函数日志获取详细错误信息

### 3. 响应格式错误
- 新实现支持多种响应格式：
  - 同步模式: `audio_url` 字段
  - 异步模式: `task_id` 字段
  - 数据封装: `data.audio_url` 字段

## 📊 监控和日志

- 所有关键操作都有详细的控制台日志
- API 响应状态和内容会被记录
- 支持异步任务状态轮询

## 🆕 新特性

1. **官方 MCP 兼容性**: 基于 MiniMax-MCP-JS 官方实现
2. **更好的错误处理**: 详细的错误诊断和日志
3. **灵活的响应格式**: 支持多种 API 响应格式
4. **日语优化**: 专门针对日语语音合成优化
5. **简化配置**: 减少复杂的语音映射配置

## 🔗 相关资源

- [MiniMax-MCP GitHub](https://github.com/MiniMax-AI/MiniMax-MCP)
- [MiniMax-MCP-JS GitHub](https://github.com/MiniMax-AI/MiniMax-MCP-JS)
- [MiniMax 官方文档](https://www.minimax.io/platform)
- [MiniMax API 文档](https://platform.minimaxi.com/document/text-to-speech-pro) 