export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.MINIMAX_API_KEY) {
      return res.status(500).json({ error: '未配置MiniMax API Key' });
    }

    const minimaxHost = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';

    // 尝试获取可用的语音列表
    try {
      const voicesResponse = await fetch(`${minimaxHost}/v1/text_to_speech/voices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json();
        console.log('MiniMax voices response:', voicesData);
        
        res.status(200).json({
          success: true,
          voices: voicesData.voices || voicesData,
          raw_response: voicesData
        });
      } else {
        throw new Error(`API responded with ${voicesResponse.status}`);
      }
    } catch (apiError) {
      console.log('Voice API调用失败，返回预设选项:', apiError.message);
      
      // 返回预设的日语语音选项
      res.status(200).json({
        success: true,
        voices: [],
        message: 'API调用失败，使用预设语音选项',
        defaultVoices: [
          {
            voice_id: 'female-japanese-warm',
            name: '温柔日语女声',
            gender: 'female',
            language: 'ja',
            description: '适合对话式和叙述式播客'
          },
          {
            voice_id: 'female-japanese-professional',
            name: '专业日语女声',
            gender: 'female',
            language: 'ja',
            description: '适合教育性播客'
          },
          {
            voice_id: 'male-japanese-warm',
            name: '温和日语男声',
            gender: 'male',
            language: 'ja',
            description: '适合对话式和叙述式播客'
          },
          {
            voice_id: 'male-japanese-professional',
            name: '专业日语男声',
            gender: 'male',
            language: 'ja',
            description: '适合教育性和访谈式播客'
          }
        ]
      });
    }

  } catch (error) {
    console.error('获取语音列表时发生错误:', error);
    res.status(500).json({
      error: '获取语音列表失败',
      details: error.message
    });
  }
}
