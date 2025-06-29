export default async function handler(req, res) {
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
    const { content, style = 'educational', voice = 'female', _test_mode = false } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '请提供内容' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: '未配置OpenAI API Key' });
    }

    console.log('开始生成播客，内容长度:', content.length);

    // 第一步：使用OpenAI生成日语播客脚本
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
            content: `あなたは日本語ポッドキャスト専門家です。自然で魅力的な日本語ポッドキャストスクリプトを作成してください。

スタイル: ${style}
音声タイプ: ${voice}

要求：
1. 敬語（丁寧語）を適切に使用
2. ポッドキャストに適した口語表現に変換
3. 自然な間や停顿を含める（、や。で適切な間を作る）
4. 聴衆との対話要素を含む（「皆さん」「いかがでしょうか」など）
5. 開始、主要内容、結語の構造を持つ
6. 読み上げやすい文章構造
7. 約8-12分の長さ（約1500-2500字）

特別注意：
- 読み上げ時に自然に聞こえるよう、漢字にふりがなが必要な場合は括弧で追記
- 数字は読み方を明確に（例：2024年→二千二十四年）
- 専門用語は説明を付加`
          },
          {
            role: 'user',
            content: `以下の内容を日本語ポッドキャストスクリプトに変換してください：\n\n${content}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI API错误:', await openaiResponse.text());
      return res.status(500).json({ error: 'OpenAI API调用失败' });
    }

    const openaiData = await openaiResponse.json();
    const script = openaiData.choices[0]?.message?.content;

    if (!script) {
      return res.status(500).json({ error: '未能生成播客脚本' });
    }

    console.log('脚本生成成功，长度:', script.length);

    // 第二步：使用MiniMax Text-to-Audio API（基于官方MCP-JS实现）
    let audioUrl = null;
    let taskId = null;
    
    // 基于MiniMax-MCP-JS的语音映射
    const voiceMapping = {
      female: 'female-shaonv', // 官方推荐的女性日语语音
      male: 'male-qn-qingse'   // 官方推荐的男性日语语音
    };
    
    const selectedVoiceId = voiceMapping[voice] || 'female-shaonv';
    
    if (process.env.MINIMAX_API_KEY) {
      try {
        // 使用MiniMax全球版API主机
        const minimaxHost = process.env.MINIMAX_API_HOST || 'https://api.minimax.io';
        
        console.log('使用MiniMax API主机:', minimaxHost);
        console.log('使用语音ID:', selectedVoiceId);
        
        // 基于官方MiniMax-MCP-JS的text_to_audio参数格式
        const ttsPayload = {
          text: script,
          model: 'speech-02-hd', // 使用最新的高质量模型
          voiceId: selectedVoiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
          emotion: 'neutral',
          format: 'mp3',
          sampleRate: 32000,
          bitrate: 128000,
          channel: 1,
          languageBoost: 'ja', // 日语增强
          stream: false
        };

        console.log('开始MiniMax文本转语音，使用官方MCP参数格式');

        // 调用MiniMax Text-to-Speech API
        const ttsResponse = await fetch(`${minimaxHost}/v1/text_to_speech`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ttsPayload)
        });

        const responseText = await ttsResponse.text();
        console.log('MiniMax API响应状态:', ttsResponse.status);
        console.log('MiniMax API响应内容:', responseText.substring(0, 200) + '...');

        if (ttsResponse.ok) {
          let ttsResult;
          try {
            ttsResult = JSON.parse(responseText);
          } catch (parseError) {
            console.error('解析MiniMax响应JSON失败:', parseError);
            throw new Error('MiniMax API响应格式错误');
          }
          
          if (ttsResult.task_id) {
            // 异步任务模式
            taskId = ttsResult.task_id;
            console.log('MiniMax异步任务创建成功，task_id:', taskId);
            
            // 轮询任务状态（简化版，最多尝试5次）
            let pollAttempts = 0;
            const maxPollAttempts = 5;
            
            while (pollAttempts < maxPollAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
              
              try {
                const statusResponse = await fetch(`${minimaxHost}/v1/text_to_speech/${taskId}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                  }
                });
                
                if (statusResponse.ok) {
                  const statusResult = await statusResponse.json();
                  console.log(`任务状态检查 ${pollAttempts + 1}:`, statusResult.status);
                  
                  if (statusResult.status === 'Success' && statusResult.audio_url) {
                    audioUrl = statusResult.audio_url;
                    console.log('MiniMax语音合成成功完成');
                    break;
                  } else if (statusResult.status === 'Failed') {
                    console.error('MiniMax语音合成失败:', statusResult.error_message);
                    break;
                  }
                  // 'Processing' 状态继续等待
                } else {
                  console.error('状态查询失败:', await statusResponse.text());
                }
              } catch (pollError) {
                console.error('轮询状态时出错:', pollError);
              }
              
              pollAttempts++;
            }
            
          } else if (ttsResult.audio_url) {
            // 同步模式 - 直接返回音频URL
            audioUrl = ttsResult.audio_url;
            console.log('MiniMax语音合成完成（同步模式）');
            
          } else if (ttsResult.data && ttsResult.data.audio_url) {
            // 某些情况下音频URL在data字段中
            audioUrl = ttsResult.data.audio_url;
            console.log('MiniMax语音合成完成（data字段）');
            
          } else {
            console.log('MiniMax响应格式不包含audio_url或task_id:', ttsResult);
          }
          
        } else {
          console.error('MiniMax TTS API错误:', responseText);
          
          // 检查是否是API密钥问题
          if (ttsResponse.status === 401) {
            console.error('API密钥验证失败，请检查MINIMAX_API_KEY和MINIMAX_API_HOST是否匹配');
          }
        }
        
      } catch (audioError) {
        console.error('音频生成过程出错:', audioError);
      }
    } else {
      console.log('未配置MINIMAX_API_KEY，跳过音频生成');
    }

    // 计算统计信息
    const wordCount = script.length;
    const estimatedDuration = Math.ceil(wordCount / 5); // 日语约每秒5字符

    const result = {
      success: true,
      script,
      audioUrl,
      taskId,
      wordCount,
      duration: estimatedDuration,
      style,
      voice,
      metadata: {
        contentLength: content.length,
        scriptLength: script.length,
        hasAudio: !!audioUrl,
        isAsyncTask: !!taskId,
        language: 'japanese',
        voiceId: selectedVoiceId,
        generatedAt: new Date().toISOString(),
        mcpBased: true // 标记这是基于MCP的实现
      }
    };

    console.log('播客生成完成，是否有音频:', !!audioUrl);
    res.status(200).json(result);

  } catch (error) {
    console.error('生成播客时发生错误:', error);
    res.status(500).json({
      error: '播客生成失败',
      details: error.message
    });
  }
}
