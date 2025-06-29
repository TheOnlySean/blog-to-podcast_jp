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
    const { content, style = 'educational', voice = 'female' } = req.body;
    
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
7. 約10-15分の長さ（約2000-3000字）

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

    // 第二步：使用MiniMax异步长文本语音合成 - 真实的日语语音ID
    let audioUrl = null;
    let taskId = null;
    
    // 使用用户提供的真实MiniMax日语语音ID (移到条件块外部)
    const japaneseVoiceMapping = {
      female: {
        educational: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a',
        conversational: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a', 
        narrative: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a',
        interview: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a'
      },
      male: {
        educational: 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df',
        conversational: 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df',
        narrative: 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df', 
        interview: 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df'
      }
    };

    // 选择合适的日语语音ID
    const voiceId = japaneseVoiceMapping[voice]?.[style] || 
                           (voice === 'female' ? 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a' : 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df');
    
    if (process.env.MINIMAX_API_KEY) {
      try {

        const minimaxHost = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
        
        // 根据MiniMax异步长文本语音合成API格式
        const ttsPayload = {
          model: 'speech-01-turbo',
          text: script,
          stream: false,
          voice_setting: {
            voice_id: voiceId,
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
            emotion: 'neutral'
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1
          },
          pronunciation_setting: {
            language: 'ja'
          }
        };

        console.log('开始MiniMax异步语音合成，voice_id:', voiceId);

        // 创建异步TTS任务
        const ttsResponse = await fetch(`${minimaxHost}/v1/text_to_speech`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ttsPayload)
        });

        if (ttsResponse.ok) {
          const ttsResult = await ttsResponse.json();
          
          if (ttsResult.task_id) {
            // 异步任务模式
            taskId = ttsResult.task_id;
            console.log('MiniMax异步任务创建成功，task_id:', taskId);
            
            // 轮询任务状态
            let pollAttempts = 0;
            const maxPollAttempts = 20; // 最多轮询20次（约3分钟）
            
            while (pollAttempts < maxPollAttempts) {
              await new Promise(resolve => setTimeout(resolve, 8000)); // 等待8秒
              
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
            
            if (pollAttempts >= maxPollAttempts && !audioUrl) {
              console.log('语音合成超时，但返回脚本');
            }
            
          } else if (ttsResult.audio_url) {
            // 同步模式 - 直接返回音频URL
            audioUrl = ttsResult.audio_url;
            console.log('MiniMax语音合成完成（同步模式）');
          }
          
        } else {
          const errorText = await ttsResponse.text();
          console.error('MiniMax TTS API错误:', errorText);
        }
        
      } catch (audioError) {
        console.error('音频生成过程出错:', audioError);
      }
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
        voiceId: voiceId,
        generatedAt: new Date().toISOString()
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
