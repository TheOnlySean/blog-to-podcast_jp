export default async function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;
    
    if (!url || url.trim().length === 0) {
      return res.status(400).json({ error: '请提供URL链接' });
    }

    // URL验证
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return res.status(400).json({ error: 'URL必须是http或https协议' });
      }
    } catch (urlError) {
      return res.status(400).json({ error: 'URL格式无效' });
    }

    console.log('开始处理URL:', url);

    // 检查是否为Twitter/X链接
    const isTwitterUrl = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
    
    if (isTwitterUrl) {
      return await handleTwitterUrl(url, req, res);
    } else {
      return await handleRegularUrl(url, req, res);
    }

  } catch (error) {
    console.error('处理URL时发生错误:', error);
    return res.status(500).json({
      error: '内容处理失败',
      details: error.message
    });
  }
}

// 处理Twitter/X链接
async function handleTwitterUrl(url, req, res) {
  console.log('处理Twitter/X链接:', url);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: '未配置OpenAI API Key'
    });
  }

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `分析Twitter/X帖子并生成适合アキラ（女性）和ユウキ（男性）双人日语播客讨论的详细内容。提供3500-4500字的丰富背景信息和讨论素材。`
          },
          {
            role: 'user',
            content: `请分析这个Twitter/X链接：${url}\n\n生成适合アキラ（明・女性）和ユウキ（雄樹・男性）双人播客对话的丰富内容。`
          }
        ],
        max_tokens: 5000,
        temperature: 0.8
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API错误:', errorText);
      return res.status(500).json({ 
        error: 'OpenAI API调用失败'
      });
    }

    const openaiData = await openaiResponse.json();
    let analysisResult = openaiData.choices[0]?.message?.content;

    if (!analysisResult) {
      return res.status(500).json({ error: '未能分析Twitter内容' });
    }

    const result = {
      success: true,
      url,
      content: analysisResult,
      title: "Twitter/X帖子分析 - 播客内容",
      metadata: {
        contentLength: analysisResult.length,
        source: 'twitter',
        scrapedAt: new Date().toISOString()
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('处理Twitter链接时出错:', error);
    return res.status(500).json({
      error: 'Twitter链接处理失败',
      details: error.message
    });
  }
}

// 处理常规网页
async function handleRegularUrl(url, req, res) {
  console.log('处理常规网页:', url);

  // 简单的网页抓取（如果没有Firecrawl）
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Podcast-Bot/1.0)'
      }
    });

    if (!response.ok) {
      return res.status(400).json({ error: '无法访问该网页' });
    }

    const html = await response.text();
    
    // 简单的内容提取
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (content.length > 10000) {
      content = content.substring(0, 10000) + '...';
    }

    if (content.length < 100) {
      return res.status(400).json({ error: '提取的内容过短' });
    }

    const result = {
      success: true,
      url,
      title: "网页内容",
      content,
      metadata: {
        contentLength: content.length,
        source: 'web_scraping',
        scrapedAt: new Date().toISOString()
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('网页抓取失败:', error);
    return res.status(500).json({
      error: '网页抓取失败',
      details: error.message
    });
  }
}
// Force deployment trigger Sun Jun 29 00:19:56 JST 2025
