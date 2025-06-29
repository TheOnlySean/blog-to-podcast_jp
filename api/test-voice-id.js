export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { style = 'educational', voice = 'female' } = req.query;
    
    // 使用与generate.js相同的映射逻辑
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

    // 选择合适的日语语音ID，添加详细的fallback逻辑
    let voiceId;
    
    // 首先尝试从映射中获取
    if (japaneseVoiceMapping[voice] && japaneseVoiceMapping[voice][style]) {
      voiceId = japaneseVoiceMapping[voice][style];
    } else {
      // 如果映射失败，使用默认值
      voiceId = (voice === 'female') ? 
        'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a' : 
        'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df';
    }
    
    // 最后的安全检查
    if (!voiceId) {
      voiceId = 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a'; // 默认使用女性声音
    }
    
    console.log('测试voiceId选择 - 语音类型:', voice, '风格:', style, '选择的ID:', voiceId);

    const result = {
      success: true,
      input: {
        voice,
        style
      },
      output: {
        voiceId,
        isValid: !!voiceId,
        isFromMapping: !!(japaneseVoiceMapping[voice] && japaneseVoiceMapping[voice][style]),
        mapping: japaneseVoiceMapping
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('VoiceId测试失败:', error);
    res.status(500).json({
      error: 'VoiceId测试失败',
      details: error.message
    });
  }
} 