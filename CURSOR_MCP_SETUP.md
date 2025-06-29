# 🎯 Cursor MiniMax-MCP 配置指南

## ✅ **安装确认**

- ✅ `uvx` 已成功安装：`/Users/x.sean/.local/bin/uvx`
- ✅ `minimax-mcp` 已通过uvx安装

## 📝 **Cursor MCP 配置步骤**

### **1. 打开Cursor设置**

在Cursor中：
1. 打开 **Cursor → Preferences → Cursor Settings**
2. 找到 **MCP** 部分
3. 点击 **Add new global MCP Server**

### **2. 配置MiniMax MCP服务器**

#### **方法1：推荐配置（使用相对路径）**
```json
{
  "mcpServers": {
    "minimax": {
      "command": "uvx",
      "args": [
        "minimax-mcp",
        "-y"
      ],
      "env": {
        "MINIMAX_API_KEY": "your_minimax_api_key_here",
        "MINIMAX_MCP_BASE_PATH": "/Users/x.sean/Desktop",
        "MINIMAX_API_HOST": "https://api.minimax.io",
        "MINIMAX_API_RESOURCE_MODE": "url"
      }
    }
  }
}
```

#### **方法2：使用完整路径（如果方法1不工作）**
```json
{
  "mcpServers": {
    "minimax": {
      "command": "/Users/x.sean/.local/bin/uvx",
      "args": [
        "minimax-mcp",
        "-y"
      ],
      "env": {
        "MINIMAX_API_KEY": "your_minimax_api_key_here",
        "MINIMAX_MCP_BASE_PATH": "/Users/x.sean/Desktop",
        "MINIMAX_API_HOST": "https://api.minimax.io",
        "MINIMAX_API_RESOURCE_MODE": "url"
      }
    }
  }
}
```

### **3. 配置参数说明**

| 参数 | 说明 | 值 |
|------|------|-----|
| `MINIMAX_API_KEY` | 您的MiniMax API密钥 | 从 [MiniMax Platform](https://www.minimax.io/platform/user-center/basic-information/interface-key) 获取 |
| `MINIMAX_API_HOST` | API主机地址 | `https://api.minimax.io` (全球版) |
| `MINIMAX_MCP_BASE_PATH` | 本地文件保存路径 | `/Users/x.sean/Desktop` |
| `MINIMAX_API_RESOURCE_MODE` | 资源模式 | `url` (推荐) 或 `local` |

## 🔧 **配置后步骤**

### **1. 重启Cursor**
保存配置后，完全重启Cursor以加载MCP服务器。

### **2. 验证MCP工具**
在Cursor的聊天界面中，您应该能看到以下MiniMax工具：

- ✅ `text_to_audio` - 文本转语音
- ✅ `list_voices` - 列出可用语音
- ✅ `voice_clone` - 语音克隆
- ✅ `generate_video` - 视频生成
- ✅ `text_to_image` - 文本转图像

### **3. 测试MCP功能**
在Cursor聊天中尝试：
```
请使用text_to_audio工具将以下日语文本转换为语音：
"こんにちは、皆さん。今日は素晴らしい一日ですね。"
```

## 🚨 **故障排除**

### **问题1：找不到uvx命令**
**解决方案**：使用完整路径配置（方法2）

### **问题2：MCP服务器启动失败**
**检查**：
1. API密钥是否正确设置
2. 网络连接是否正常
3. Cursor日志中的错误信息

### **问题3：没有看到MiniMax工具**
**解决方案**：
1. 完全重启Cursor
2. 检查MCP配置格式是否正确
3. 查看Cursor的MCP日志

## 📋 **配置文件位置**

如果您更愿意直接编辑配置文件：

**配置文件路径**：
```
~/Library/Application Support/Cursor/User/globalStorage/claude-desktop-config.json
```

## 🧪 **测试命令**

您也可以在终端中直接测试MCP：
```bash
# 设置环境变量
export MINIMAX_API_KEY="your_api_key_here"
export MINIMAX_API_HOST="https://api.minimax.io"
export MINIMAX_MCP_BASE_PATH="/Users/x.sean/Desktop"

# 运行MCP服务器
uvx minimax-mcp -y
```

## 📞 **获取帮助**

如果遇到问题：
1. 检查 [MiniMax-MCP GitHub Issues](https://github.com/MiniMax-AI/MiniMax-MCP/issues)
2. 确认API密钥有效性
3. 查看Cursor MCP日志

---

**🎉 配置完成后，您就可以在Cursor中直接使用MiniMax的强大AI功能了！** 