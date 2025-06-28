# 🚨 紧急部署修复指南

## 问题
Vercel项目意外开启了身份验证保护，导致API无法访问

## 修复步骤

### 方案1: 修改项目设置
1. 访问: https://vercel.com/dashboard
2. 找到项目: blog-to-podcast_jp
3. Settings → General
4. 关闭 "Password Protection" 和 "Vercel Authentication"

### 方案2: 重新部署
1. 删除当前Vercel项目
2. 重新从GitHub导入
3. 确保设置为公开访问

## 检查方法
访问以下URL应该返回网页而不是认证页面:
https://blog-to-podcast-hg64uwazb-theonlyseans-projects.vercel.app/

## API端点
- /api/scrape - 内容抓取
- /api/generate - 播客生成  
- /api/voices - 语音列表
