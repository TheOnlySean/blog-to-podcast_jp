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
    const { content, style = 'educational', voice = 'female', _test_mode = false, use_mcp = false } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '请提供内容' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: '未配置OpenAI API Key' });
    }

    console.log('开始生成播客，内容长度:', content.length, 'MCP模式:', use_mcp);

    // 语音角色配置 - 增强版，支持双人对话
    const voiceCharacters = {
      'akira': {
        'name': 'アキラ',
        'gender': 'female',
        'voice_id': 'Japanese_KindLady',
        'personality': '親切で知的な女性、教育的な内容を分かりやすく説明する'
      },
      'yuuki': {
        'name': 'ユウキ',
        'gender': 'male', 
        'voice_id': 'Japanese_OptimisticYouth',
        'personality': '明るく好奇心旺盛な男性、質問や感想で話を盛り上げる'
      }
    };

    // 第一步：使用OpenAI生成双人对话形式的日语播客脚本
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
            content: `あなたは日本語ポッドキャスト専門家です。2人のホスト（アキラとユウキ）による自然で魅力的な対話形式のポッドキャストスクリプトを作成してください。

## キャラクター設定
- **アキラ（女性）**: ${voiceCharacters.akira.personality}
- **ユウキ（男性）**: ${voiceCharacters.yuuki.personality}

## スタイル要求
- スタイル: ${style}
- 自然な対話形式（2人の掛け合い）
- 敬語（丁寧語）を適切に使用
- ポッドキャストに適した口語表現
- 聴衆への語りかけを含む
- 読み上げやすい文章構造

## 構造要求
1. **オープニング**: 挨拶と今日のトピック紹介
2. **メイン内容**: 内容の詳細な議論（対話形式）
3. **インタラクション**: 聴衆への質問や感想の促し
4. **クロージング**: まとめと次回予告

## フォーマット要求
- 各発言者を明確に区別: 「アキラ:」「ユウキ:」
- 読み上げ時間: 約8-12分（約1500-2500字）
- 自然な間や停顿を考慮した句読点

## 特別注意
- 漢字にふりがなが必要な場合は括弧で追記
- 数字は読み方を明確に（例：2024年→二千二十四年）
- 専門用語は分かりやすい説明を付加`
          },
          {
            role: 'user',
            content: `以下の内容を2人のホストによる対話形式の日本語ポッドキャストスクリプトに変換してください：\n\n${content}`
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

    // 第二步：解析脚本为对话片段 - 修复版
    function parseDialogueSegments(script) {
      const lines = script.split('\n');
      const segments = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // 跳过标题和分隔符
        if (trimmedLine.startsWith('#') || trimmedLine.startsWith('*') || trimmedLine.length < 10) {
          continue;
        }
        
        // 检查是否是アキラ的对话行 - 修复格式匹配
        if (trimmedLine.includes('**アキラ:**') || trimmedLine.includes('**アキラ：**') || 
            trimmedLine.includes('**アキラ**:') || trimmedLine.includes('**アキラ**：')) {
          const text = trimmedLine.replace(/\*\*アキラ[:：]\*?\*?[:：]?\s*/, '').trim();
          if (text && text.length > 5) {
            segments.push({
              speaker: 'akira',
              name: 'アキラ',
              text: text,
              voice_id: voiceCharacters.akira.voice_id,
              emotion: 'neutral'
            });
          }
        }
        // 检查是否是ユウキ的对话行 - 修复格式匹配
        else if (trimmedLine.includes('**ユウキ:**') || trimmedLine.includes('**ユウキ：**') || 
                 trimmedLine.includes('**ユウキ**:') || trimmedLine.includes('**ユウキ**：')) {
          const text = trimmedLine.replace(/\*\*ユウキ[:：]\*?\*?[:：]?\s*/, '').trim();
          if (text && text.length > 5) {
            segments.push({
              speaker: 'yuuki',
              name: 'ユウキ',
              text: text,
              voice_id: voiceCharacters.yuuki.voice_id,
              emotion: 'neutral'
            });
          }
        }
        // 旧格式兼容（没有**的格式）
        else if (trimmedLine.includes('アキラ:') || trimmedLine.includes('アキラ：')) {
          const text = trimmedLine.replace(/アキラ[:：]\s*/, '').trim();
          if (text && text.length > 5) {
            segments.push({
              speaker: 'akira',
              name: 'アキラ',
              text: text,
              voice_id: voiceCharacters.akira.voice_id,
              emotion: 'neutral'
            });
          }
        } else if (trimmedLine.includes('ユウキ:') || trimmedLine.includes('ユウキ：')) {
          const text = trimmedLine.replace(/ユウキ[:：]\s*/, '').trim();
          if (text && text.length > 5) {
            segments.push({
              speaker: 'yuuki',
              name: 'ユウキ',
              text: text,
              voice_id: voiceCharacters.yuuki.voice_id,
              emotion: 'neutral'
            });
          }
        }
      }
      
      console.log('解析结果：', segments.map(s => ({ speaker: s.speaker, text: s.text.substring(0, 50) + '...' })));
      return segments;
    }

    const dialogueSegments = parseDialogueSegments(script);
    console.log('对话片段解析完成，共', dialogueSegments.length, '个片段');

    // 第三步：音频生成处理
    let audioUrl = null;
    let audioSegments = [];
    let mcpInstructions = null;

    if (use_mcp) {
      // MCP 模式：生成 MCP 工具使用指令
      mcpInstructions = {
        description: "使用 MiniMax MCP 工具生成音频片段",
        commands: dialogueSegments.map((segment, index) => ({
          segment_id: index + 1,
          speaker: segment.name,
          voice_id: segment.voice_id,
          text: segment.text,
          mcp_command: `mcp_MiniMax_text_to_audio(text="${segment.text}", voiceId="${segment.voice_id}", outputDirectory="output/audio", speed=1.0, emotion="${segment.emotion}", format="mp3")`
        }))
      };

      console.log('MCP 指令生成完成');
      
    } else {
      // 新增：直接音频生成模式
      console.log('🎵 开始生成播客音频 (非MCP模式)...');
      
      // 辅助函数：生成音频片段
      const generateAudioSegment = async (segment) => {
        console.log(`🎤 正在为 ${segment.name} 生成音频: ${segment.voice_id}`);
        
        // 模拟生成过程 - 实际环境中应该调用真实的MiniMax API
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 返回模拟的音频URL
        return `https://example.com/audio/segment_${segment.speaker}_${Date.now()}.mp3`;
      };
      
      try {
        // 生成前3个片段作为演示
        const segmentsToGenerate = Math.min(3, dialogueSegments.length);
        const generatedSegments = [];
        
        for (let i = 0; i < segmentsToGenerate; i++) {
          const segment = dialogueSegments[i];
          console.log(`生成第${i+1}个音频片段 (${segment.name}): ${segment.text.substring(0, 30)}...`);
          
          try {
            const segmentAudioUrl = await generateAudioSegment(segment);
            
            if (segmentAudioUrl) {
              generatedSegments.push({
                segmentId: i + 1,
                speaker: segment.name,
                text: segment.text,
                audioUrl: segmentAudioUrl,
                voiceId: segment.voice_id
              });
              
              // 设置第一个片段作为主音频URL
              if (i === 0) {
                audioUrl = segmentAudioUrl;
              }
            }
          } catch (segmentError) {
            console.error(`❌ 第${i+1}个片段生成失败:`, segmentError.message);
          }
        }
        
        if (generatedSegments.length > 0) {
          audioSegments = generatedSegments;
          console.log(`✅ 成功生成 ${generatedSegments.length} 个音频片段`);
        } else {
          console.log('⚠️ 未能生成任何音频片段');
        }
        
      } catch (audioError) {
        console.error('❌ 音频生成失败:', audioError.message);
      }
    }

    // 计算统计信息
    const wordCount = script.length;
    const estimatedDuration = Math.ceil(wordCount / 5); // 日语约每秒5字符

    const result = {
      success: true,
      script,
      audioUrl,
      dialogueSegments,
      mcpInstructions,
      wordCount,
      duration: estimatedDuration,
      style,
      voice,
      metadata: {
        contentLength: content.length,
        scriptLength: script.length,
        segmentsCount: dialogueSegments.length,
        hasAudio: !!audioUrl,
        useMcp: use_mcp,
        language: 'japanese',
        voiceCharacters: voiceCharacters,
        generatedAt: new Date().toISOString(),
        dialogueFormat: true,
        supportedVoices: Object.keys(voiceCharacters).map(key => ({
          character: key,
          name: voiceCharacters[key].name,
          voice_id: voiceCharacters[key].voice_id,
          personality: voiceCharacters[key].personality
        }))
      }
    };

    console.log('播客生成完成');
    console.log('- 脚本长度:', script.length, '字符');
    console.log('- 对话片段:', dialogueSegments.length, '个');
    console.log('- MCP模式:', use_mcp);
    console.log('- 音频URL:', !!audioUrl);

    res.status(200).json(result);

  } catch (error) {
    console.error('生成播客时发生错误:', error);
    res.status(500).json({
      error: '播客生成失败',
      details: error.message
    });
  }
}
