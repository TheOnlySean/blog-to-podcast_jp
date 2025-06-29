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

    console.log('🚀 开始处理URL:', url);

    // 检查是否为Twitter/X链接
    const isTwitterUrl = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
    
    // 统一使用Firecrawl优先的抓取策略
    return await handleUrlWithFirecrawlFirst(url, isTwitterUrl, req, res);

  } catch (error) {
    console.error('处理URL时发生错误:', error);
    return res.status(500).json({
      error: '内容处理失败',
      details: error.message
    });
  }
}

// 优先使用Firecrawl的统一抓取策略（参考原始项目）- 已改进
async function handleUrlWithFirecrawlFirst(url, isTwitterUrl, req, res) {
  console.log(`🔧 处理${isTwitterUrl ? 'Twitter/X' : '常规网页'}链接:`, url);

  // 检查API密钥
  const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasOpenAI) {
    console.error('❌ 缺少OpenAI API Key');
    return res.status(500).json({ 
      error: '未配置OpenAI API Key',
      message: '内容分析需要OpenAI API Key，请在Vercel环境变量中配置OPENAI_API_KEY'
    });
  }

  // 对于Twitter链接，强制要求Firecrawl
  if (isTwitterUrl && !hasFirecrawl) {
    console.error('❌ Twitter链接需要Firecrawl API Key');
    return res.status(500).json({ 
      error: '未配置Firecrawl API Key',
      message: 'Twitter内容抓取需要Firecrawl API Key，请在Vercel环境变量中配置FIRECRAWL_API_KEY'
    });
  }

  // 第一步：内容抓取（优先使用Firecrawl）
  let scrapedContent = '';
  let scrapedTitle = '';
  let extractionMethod = '';
  let firecrawlSuccess = false;

  if (hasFirecrawl) {
    console.log('🔥 使用Firecrawl专业抓取 (推荐方式)...');
    try {
      const firecrawlResult = await scrapeWithFirecrawl(url, isTwitterUrl);
      if (firecrawlResult.success) {
        scrapedContent = firecrawlResult.content;
        scrapedTitle = firecrawlResult.title;
        extractionMethod = 'firecrawl_professional';
        firecrawlSuccess = true;
        console.log('✅ Firecrawl抓取成功');
      } else {
        console.log('⚠️ Firecrawl抓取失败，尝试备用方法');
      }
    } catch (error) {
      console.error('❌ Firecrawl抓取出错:', error.message);
    }
  }

  // 备用抓取方法（仅用于非Twitter链接且Firecrawl失败时）
  if (!firecrawlSuccess && !isTwitterUrl) {
    console.log('🔄 回退到基础抓取方法...');
    try {
      const fallbackResult = await scrapeWithFallback(url);
      if (fallbackResult.success) {
        scrapedContent = fallbackResult.content;
        scrapedTitle = fallbackResult.title;
        extractionMethod = 'fallback_basic';
        console.log('✅ 基础抓取成功');
      }
    } catch (error) {
      console.error('❌ 基础抓取也失败:', error.message);
    }
  }

  // 如果常规抓取都失败，使用AI基于URL生成内容
  if (!scrapedContent || scrapedContent.length < 50) {
    if (!isTwitterUrl) {
      console.log('🤖 所有抓取方法失败，使用AI基于URL分析...');
      try {
        const aiGeneratedResult = await generateContentFromUrl(url);
        if (aiGeneratedResult.success) {
          scrapedContent = aiGeneratedResult.content;
          scrapedTitle = aiGeneratedResult.title;
          extractionMethod = 'ai_url_analysis';
          console.log('✅ AI基于URL生成内容成功');
        }
      } catch (error) {
        console.error('❌ AI基于URL生成失败:', error.message);
      }
    }
  }

  // 最终验证
  if (!scrapedContent || scrapedContent.length < 20) {
    console.error('❌ 所有方法都未能获取有效内容');
    return res.status(400).json({ 
      error: '内容抓取失败',
      message: isTwitterUrl ? 
        '无法获取Twitter内容，请检查链接是否为公开帖子，或联系help@firecrawl.com激活更多网站' : 
        '无法获取网页内容，请检查链接是否有效',
      debug: {
        contentLength: scrapedContent?.length || 0,
        firecrawlAvailable: hasFirecrawl,
        firecrawlSuccess,
        extractionMethod,
        url: url
      }
    });
  }

  console.log('📝 抓取成功 - 内容长度:', scrapedContent.length, '方法:', extractionMethod);

  // 第二步：AI内容分析和扩展
  console.log('🤖 开始AI深度分析...');
  
  try {
    const analysisResult = await analyzeContentWithOpenAI(scrapedContent, scrapedTitle, url, isTwitterUrl);
    
    if (!analysisResult) {
      console.error('❌ AI分析失败');
      return res.status(500).json({ 
        error: '内容分析失败',
        message: '无法完成内容分析，请稍后重试'
      });
    }

    console.log('✅ 内容分析完成，结果长度:', analysisResult.length);

    // 构建最终结果
    const result = {
      success: true,
      url,
      content: analysisResult,
      title: scrapedTitle + " - AI深度分析",
      metadata: {
        contentLength: analysisResult.length,
        source: isTwitterUrl ? 'twitter_enhanced' : 'web_enhanced',
        scrapedAt: new Date().toISOString(),
        domain: new URL(url).hostname,
        extractionMethod,
        firecrawlSuccess,
        firecrawlAvailable: hasFirecrawl,
        originalContentLength: scrapedContent.length,
        contentType: isTwitterUrl ? 'social_media_analysis' : 'web_article_analysis',
        estimatedReadingTime: Math.ceil(analysisResult.length / 300),
        processingSteps: [
          hasFirecrawl ? 'firecrawl_scraping' : 'fallback_scraping',
          'openai_analysis',
          'content_enhancement'
        ]
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ AI分析过程出错:', error);
    return res.status(500).json({
      error: '内容分析失败',
      details: error.message,
      message: '处理过程中发生错误，请重试'
    });
  }
}

// Firecrawl专业抓取（参考原始项目）
async function scrapeWithFirecrawl(url, isTwitterUrl) {
  try {
    const requestBody = {
      url: url,
      formats: ["markdown", "html"]
    };

    // Twitter特殊配置
    if (isTwitterUrl) {
      requestBody.extractorOptions = {
        mode: "llm-extraction",
        extractionPrompt: "Extract the complete tweet content including: main tweet text, any images or media descriptions, replies if visible, quoted tweets, linked articles/content, hashtags, user information, and thread context. Preserve all important details and context."
      };
    }

    console.log('📡 调用Firecrawl API...');
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Firecrawl API错误:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      console.error('❌ Firecrawl返回失败:', data.error || '未知错误');
      return { success: false, error: data.error || '抓取失败' };
    }

    const content = data.data.markdown || data.data.content || data.data.html || '';
    const title = data.data.metadata?.title || data.data.metadata?.ogTitle || 
                 data.data.title || (isTwitterUrl ? 'Twitter/X帖子' : '网页内容');

    return {
      success: true,
      content,
      title
    };

  } catch (error) {
    console.error('❌ Firecrawl抓取异常:', error.message);
    return { success: false, error: error.message };
  }
}

// 基础抓取备用方法（改进版）
async function scrapeWithFallback(url) {
  try {
    console.log('📡 使用基础方法抓取:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });

    console.log('📊 基础抓取响应状态:', response.status);

    if (!response.ok) {
      console.error('❌ 基础抓取HTTP错误:', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    console.log('📝 基础抓取HTML长度:', html.length);
    
    // 基础HTML解析
    let title = '网页内容';
    let content = '';

    // 提取title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/&[^;]+;/g, '');
    }

    // 尝试提取主要内容
    let mainContent = '';
    
    // 查找主要内容容器
    const mainSelectors = [
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const selector of mainSelectors) {
      const matches = html.match(selector);
      if (matches && matches.length > 0) {
        mainContent = matches.join(' ');
        break;
      }
    }

    // 如果没找到主要内容，使用整个body
    if (!mainContent) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      mainContent = bodyMatch ? bodyMatch[1] : html;
    }

    // 清理HTML内容
    content = mainContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('📝 清理后内容长度:', content.length);

    // 确保有足够的内容
    if (content.length < 50) {
      console.log('⚠️ 内容太少，尝试提取更多');
      // 如果内容太少，尝试提取更多
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (content.length > 15000) {
      content = content.substring(0, 15000) + '...';
    }

    console.log('✅ 基础抓取完成 - 标题:', title, '内容长度:', content.length);

    return {
      success: content.length > 20,
      content,
      title
    };

  } catch (error) {
    console.error('❌ 基础抓取失败:', error.message);
    return { success: false, error: error.message };
  }
}

// AI基于URL生成内容（最后备用方案）
async function generateContentFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    const systemPrompt = `你是专业的网站内容分析专家。基于给定的URL，分析其可能的内容主题并生成相关的讨论素材。`;

    const userPrompt = `基于以下URL信息，分析可能的内容主题并生成相关素材：

URL: ${url}
域名: ${domain}
路径: ${path}

请分析：
1. 根据域名和路径推测可能的内容类型和主题
2. 生成500-1000字的相关背景信息和讨论点
3. 包含该领域的一般性知识和趋势分析

注意：这是在无法直接抓取网页内容时的备用分析。`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: '未生成内容' };
    }

    return {
      success: true,
      content,
      title: `${domain} - 基于URL的内容分析`
    };

  } catch (error) {
    console.error('❌ AI基于URL生成失败:', error.message);
    return { success: false, error: error.message };
  }
}

// OpenAI内容分析（参考原始项目的prompt设计）
async function analyzeContentWithOpenAI(content, title, url, isTwitterUrl) {
  const systemPrompt = `你是专业的内容分析和日语播客制作专家。你擅长将各种内容转化为高质量的日语双人播客讨论素材。

**播客主持人设定：**
- アキラ（明）：女性，理性分析型，善于数据解读和逻辑思考
- ユウキ（雄樹）：男性，人文思考型，注重文化背景和社会意义

**核心能力：**
1. 深度内容解读和批判性思维
2. 丰富的跨领域知识储备  
3. 优秀的播客内容策划能力
4. 日语文化和表达的深度理解

**输出要求：**
- 基于提供的真实内容进行分析，确保准确性
- 深入解读内容的显性和隐性信息
- 提供相关背景知识和上下文
- 从多个角度分析意义和影响
- 扩展相关话题和讨论点
- 生成适合15-20分钟播客的丰富素材（3500-4500字）
- 内容结构清晰，讨论性强，贴近日本听众`;

  const userPrompt = `请基于以下${isTwitterUrl ? 'Twitter/X' : '网页'}的真实内容，进行深度分析并生成适合アキラ（分析型女性）和ユウキ（人文型男性）双人日语播客讨论的详细素材：

**${isTwitterUrl ? '帖子' : '文章'}标题：** ${title}
**原始链接：** ${url}

**内容：**
${content}

**具体要求：**
1. 深入分析内容的核心观点、背景信息和潜在影响
2. 提供相关的知识背景和上下文解释
3. 从多个维度（${isTwitterUrl ? '社会影响、趋势分析、用户反应' : '技术、商业、社会、文化'}等）进行分析
4. 扩展相关话题，提供丰富的讨论素材
5. 生成3500-4500字的高质量播客内容
6. 确保内容适合アキラ（分析型）和ユウキ（人文型）的对话风格
7. 包含具体的数据、案例和实用信息

请确保分析基于真实内容，提供深度见解和丰富的讨论素材。`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 6000,
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API错误:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content;

  } catch (error) {
    console.error('❌ OpenAI分析异常:', error.message);
    return null;
  }
}
