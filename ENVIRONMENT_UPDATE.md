# 🔧 Vercel 环境变量更新指南

## ⚠️ 重要：API主机更改

基于官方 MiniMax-MCP-JS 的建议，我们需要更新 API 主机地址。

## 📝 需要在 Vercel 中更新的环境变量

### 1. 访问 Vercel 项目设置
1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到您的项目：`blog-to-podcast_jp`
3. 点击项目 → Settings → Environment Variables

### 2. 更新 MINIMAX_API_HOST

**旧值**：
```
MINIMAX_API_HOST=https://api.minimaxi.com
```

**新值（根据您的区域选择）**：

#### 如果您使用全球版 MiniMax：
```
MINIMAX_API_HOST=https://api.minimaxi.chat
```
**注意**：多了一个 "i"

#### 如果您使用中国版 MiniMax：
```
MINIMAX_API_HOST=https://api.minimax.chat
```

### 3. 确认其他环境变量

确保以下环境变量已正确设置：

```bash
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# MiniMax API Key  
MINIMAX_API_KEY=your_minimax_api_key_here

# MiniMax API Host (根据上面的指引更新)
MINIMAX_API_HOST=https://api.minimaxi.chat
```

## 🚀 更新后的步骤

1. **保存环境变量**：在 Vercel 中保存更新后的环境变量
2. **触发重新部署**：Vercel 会自动重新部署应用
3. **等待部署完成**：大约需要 1-2 分钟
4. **测试功能**：重新测试 MiniMax API

## ✅ 验证配置

更新完成后，您可以：

1. 访问：https://blog-to-podcast-2aef740d5-theonlyseans-projects.vercel.app
2. 点击 "**测试 MiniMax API**" 按钮
3. 应该看到：
   - ✅ 不再出现 `Invalid API key` 错误
   - ✅ 显示正确的语音ID：`female-shaonv` 或 `male-qn-qingse`
   - ✅ 显示 `mcpBased: true` 标记
   - 🎵 如果配置正确，会生成日语音频

## 🔗 API密钥获取

如果需要重新获取API密钥：

- **全球版**：https://www.minimax.io/platform/user-center/basic-information/interface-key
- **中国版**：https://platform.minimaxi.com/user-center/basic-information/interface-key

## 📞 联系支持

如果更新后仍有问题，请：

1. 检查 Vercel 函数日志（Vercel Dashboard → Functions 标签）
2. 确认 API 密钥和主机匹配
3. 尝试重新生成 API 密钥 