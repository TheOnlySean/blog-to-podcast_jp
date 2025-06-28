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
3. 自然な間や停顿を含める
4. 聴衆との対話要素を含む
5. 開始、主要内容、結語の構造を持つ`
          },
          {
            role: 'user',
            content: `以下の内容を日本語ポッドキャストスクリプトに変換してください：\n\n${content}`
          }
        ],
        max_tokens: 3000,
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

    let audioUrl = null;
    if (process.env.MINIMAX_API_KEY) {
      try {
        const minimaxHost = process.env.MINIMAX_API_HOST || 'https://api.minimax.chat';
        const voiceId = voice === 'female' ? 'Wise_Woman' : 'Youthful_Man';

        const minimaxResponse = await fetch(`${minimaxHost}/v1/text_to_speech`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script.substring(0, 2000),
            voice_setting: {
              voice_id: voiceId,
              speed: 1.1,
              vol: 1.2,
              emotion: 'neutral'
            },
            audio_setting: {
              format: 'mp3',
              sample_rate: 32000
            }
          })
        });

        if (minimaxResponse.ok) {
          const audioData = await minimaxResponse.json();
          audioUrl = audioData.audio_url;
        }
      } catch (audioError) {
        console.error('音频生成失败:', audioError);
      }
    }

    const result = {
      success: true,
      script,
      audioUrl,
      wordCount: script.length,
      duration: Math.ceil(script.length / 4.5),
      style,
      voice
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('生成播客时发生错误:', error);
    res.status(500).json({
      error: '播客生成失败',
      details: error.message
    });
  }
}
