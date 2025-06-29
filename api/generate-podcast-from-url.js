import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// 设置ffmpeg可执行路径（在Vercel函数的只读文件系统中可正常使用）
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

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
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '请提供URL' });
    }

    console.log('🎙️ 开始一体化播客生成流程，URL:', url);

    // 语音角色配置 - 使用官方文档中的语音ID
    const voiceCharacters = {
      'akira': {
        'name': 'アキラ',
        'gender': 'female',
        'voice_id': 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a', // 用户指定女性语音
        'personality': 'かわいくて天真爛漫で、知識はまだ浅い。分からないことがあれば素直に質問し、会話を明るくする'
      },
      'yuuki': {
        'name': 'ユウキ',
        'gender': 'male',
        'voice_id': 'moss_audio_3b2bc732-4cc1-11f0-a6ae-72d5dcf0f535', // 更新后的男性语音
        'personality': '落ち着いた語り口の頼れる兄貴分。実体験や独自の視点を交え、深い洞察を述べる'
      }
    };

    // 第一步：抓取网页内容
    console.log('📄 Step 1: 抓取网页内容...');
    let scrapedContent;
    try {
      const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';
      const scrapeResponse = await fetch(`${baseUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const scrapeData = await scrapeResponse.json();
      if (!scrapeData.success) {
        return res.status(500).json({ error: '网页抓取失败: ' + scrapeData.error });
      }
      
      scrapedContent = scrapeData.content;
      if (!scrapedContent || scrapedContent.length < 100) {
        return res.status(400).json({ error: '抓取的内容太短，无法生成播客' });
      }
      
      console.log('✅ 内容抓取成功，长度:', scrapedContent.length);
      
    } catch (error) {
      console.error('抓取失败:', error);
      return res.status(500).json({ error: '网页抓取失败: ' + error.message });
    }

    // 第二步：生成双人对话脚本
    console.log('🤖 Step 2: 生成双人对话脚本...');
    let script, dialogueSegments;
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: '未配置OpenAI API Key' });
      }

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

## スタイルガイド
- ニュース本文を「朗読」せず、必ず二人の意見や感想を混ぜる
- **二人はしばしば意見が食い違い、議論やツッコミを交わす**（全部互いに同意しない）
- アキラは素朴な疑問や可愛いリアクションを挟む
- ユウキは経験談や批判的視点で掘り下げる
- 一人あたり 2〜4 文でテンポ良く交互に話す

## 重要な形式要求
# - 各行は必ず次のいずれかで始めること（先頭以外に発言者名を含めない）
#   - **アキラ:** スピーチ内容…
#   - **ユウキ:** スピーチ内容…
# - 星印とコロン（または全角コロン）以外の記号を発言者名前の前後に置かない
# - セリフ内に相手の名前や「アキラ」などを再度書かない
# - マークダウンや引用記号を使わない
# - 自然な掛け合い（交互に話す）
# - 読み上げ時間: 約3-5分（800-1200字程度）
# - 丁寧語を中心に、親しみやすい口調

## 構造要求
1. **オープニング**: 挨拶と今日のトピック紹介
2. **メイン内容**: 内容の詳細な議論（対話形式）
3. **クロージング**: まとめと感想

絶対に「**アキラ:**」「**ユウキ:**」の形式で発言者を区別してください。

# 例:
# **アキラ:** こんにちは、皆さん！
# **ユウキ:** こんにちは、アキラ。準備はいい？
# **アキラ:** もちろんです。それでは始めましょう。`
            },
            {
              role: 'user',
              content: `以下の内容を2人のホストによる対話形式の日本語ポッドキャストスクリプトに変換してください：\n\n${scrapedContent.substring(0, 3000)}`
            }
          ],
          max_tokens: 2000,
          temperature: 0.9
        })
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API错误:', errorText);
        return res.status(500).json({ error: 'OpenAI API调用失败' });
      }

      const openaiData = await openaiResponse.json();
      script = openaiData.choices[0]?.message?.content;

      if (!script) {
        return res.status(500).json({ error: '未能生成播客脚本' });
      }

      console.log('✅ 脚本生成成功，长度:', script.length);
      console.log('📝 生成的脚本前500字符:', script.substring(0, 500));

      // 解析对话片段
      dialogueSegments = parseDialogueSegments(script, voiceCharacters);
      
      if (dialogueSegments.length === 0) {
        console.log('❌ 解析失败，脚本内容:', script);
        return res.status(500).json({ 
          error: '对话片段解析失败，未找到有效的对话内容',
          debug: {
            scriptLength: script.length,
            scriptPreview: script.substring(0, 500)
          }
        });
      }

      console.log('✅ 对话片段解析完成，共', dialogueSegments.length, '个片段');
      
    } catch (error) {
      console.error('脚本生成失败:', error);
      return res.status(500).json({ error: '脚本生成失败: ' + error.message });
    }

    // 第三步：生成音频
    console.log('🎵 Step 3: 生成真实音频...');
    const audioSegments = [];
    // 生成所有片段的音频
    const maxSegments = dialogueSegments.length;
    
    // 使用正确的MiniMax配置
    const minimaxApiKey = process.env.MINIMAX_API_KEY;
    const minimaxHost = 'https://api.minimax.io';

    console.log('🔧 检查MiniMax API配置...');
    console.log('API Key存在:', !!minimaxApiKey);
    console.log('API Key长度:', minimaxApiKey ? minimaxApiKey.length : 0);
    console.log('API Host:', minimaxHost);

    if (!minimaxApiKey || minimaxApiKey.trim() === '') {
      console.log('⚠️ MINIMAX_API_KEY未配置或为空，跳过音频生成');
      // 不生成音频，但返回成功的脚本结果
      const result = {
        success: true,
        message: '播客脚本生成完成（音频生成已跳过：API Key未配置）',
        audioSegments: dialogueSegments.slice(0, maxSegments).map((seg, i) => ({
          speaker: seg.name,
          text: seg.text,
          audioUrl: null,
          voiceId: seg.voice_id,
          duration: Math.ceil(seg.text.length / 5),
          segmentId: i + 1
        })),
        dialogueSegments,
        script,
        wordCount: script.length,
        totalDuration: Math.ceil(script.length / 5),
        metadata: {
          sourceUrl: url,
          contentLength: scrapedContent.length,
          scriptLength: script.length,
          totalSegments: dialogueSegments.length,
          audioSegments: maxSegments,
          successfulAudios: 0,
          generatedAt: new Date().toISOString(),
          voiceCharacters: voiceCharacters,
          error: 'MINIMAX_API_KEY未配置'
        }
      };
      
      return res.status(200).json(result);
    }

    console.log('✅ MiniMax API配置正常，开始生成音频...');

    for (let i = 0; i < maxSegments; i++) {
      const segment = dialogueSegments[i];
      console.log(`🎤 生成音频片段 ${i + 1}/${maxSegments}: ${segment.name}`);

      try {
        const audioResult = await generateAudio(segment.text, segment.voice_id, i + 1);
        
        if (audioResult.success) {
          audioSegments.push({
            speaker: segment.name,
            text: segment.text,
            audioUrl: audioResult.audioUrl,
            voiceId: segment.voice_id,
            duration: audioResult.duration,
            segmentId: i + 1
          });
          console.log(`✅ 音频片段 ${i + 1} 生成成功`);
        } else {
          console.log(`❌ 音频片段 ${i + 1} 生成失败: ${audioResult.error}`);
          audioSegments.push({
            speaker: segment.name,
            text: segment.text,
            audioUrl: null,
            voiceId: segment.voice_id,
            duration: 0,
            segmentId: i + 1
          });
        }
      } catch (audioError) {
        console.error(`音频片段 ${i + 1} 生成异常:`, audioError.message);
        audioSegments.push({
          speaker: segment.name,
          text: segment.text,
          audioUrl: null,
          voiceId: segment.voice_id,
          duration: 0,
          segmentId: i + 1
        });
      }

      // 添加延迟，避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 计算总统计
    const totalDuration = audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
    const successfulAudios = audioSegments.filter(seg => seg.audioUrl).length;

    // ⭐ 使用 ffmpeg 合并所有成功片段
    let finalAudioUrl = null;
    if (successfulAudios > 0) {
      try {
        finalAudioUrl = await mergeSegmentsFFmpeg(audioSegments.filter(s=>s.audioUrl));
      } catch (e) {
        console.error('ffmpeg 合并失败:', e.message);
      }
    }

    const result = {
      success: true,
      message: '播客生成完成',
      audioSegments,
      dialogueSegments,
      script,
      wordCount: script.length,
      totalDuration,
      finalAudioUrl,
      metadata: {
        sourceUrl: url,
        contentLength: scrapedContent.length,
        scriptLength: script.length,
        totalSegments: dialogueSegments.length,
        audioSegments: audioSegments.length,
        successfulAudios,
        generatedAt: new Date().toISOString(),
        voiceCharacters: voiceCharacters
      }
    };

    console.log(`🎉 播客生成完成！音频成功率: ${successfulAudios}/${audioSegments.length}`);
    res.status(200).json(result);

  } catch (error) {
    console.error('一体化播客生成失败:', error);
    res.status(500).json({
      error: '播客生成失败',
      details: error.message
    });
  }
}

// 解析对话片段 - 修复正确格式
function parseDialogueSegments(script, voiceCharacters) {
  console.log('🔍 开始解析脚本，长度:', script.length);
  console.log('📝 脚本内容预览:', script.substring(0, 400));
  
  const segments = [];
  
  try {
    // 按行分析
    const lines = script.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过空行、markdown标题、分隔符
      if (!trimmed || 
          trimmed.startsWith('#') || 
          trimmed.startsWith('---') ||
          trimmed.startsWith('===') ||
          trimmed.length < 10) {
        continue;
      }
      
      const reAkira = /^\*{0,2}アキラ\*{0,2}\s*[:：-]\s*(.+)$/;
      const reYuuki = /^\*{0,2}ユウキ\*{0,2}\s*[:：-]\s*(.+)$/;

      if (reAkira.test(trimmed)) {
        let text = '';
        text = trimmed.replace(reAkira, '$1').trim();
        
        if (text.length > 5) {
          segments.push({
            speaker: 'akira',
            name: 'アキラ',
            text: text,
            voice_id: voiceCharacters.akira.voice_id,
            emotion: 'neutral'
          });
          console.log(`✅ アキラ: ${text.substring(0, 50)}...`);
        }
      }
      
      else if (reYuuki.test(trimmed)) {
        let text = '';
        text = trimmed.replace(reYuuki, '$1').trim();
        
        if (text.length > 5) {
          segments.push({
            speaker: 'yuuki',
            name: 'ユウキ',
            text: text,
            voice_id: voiceCharacters.yuuki.voice_id,
            emotion: 'neutral'
          });
          console.log(`✅ ユウキ: ${text.substring(0, 50)}...`);
        }
      }
    }
    
    console.log('🎯 解析完成，共找到', segments.length, '个有效片段');
    
    // 调试信息
    if (segments.length === 0) {
      console.log('❌ 解析失败');
      console.log('📝 脚本开头800字符:', script.substring(0, 800));
      
      // 查找所有包含说话者的行
      const lines = script.split('\n');
      const speakerLines = lines.filter(line => 
        (line.includes('アキラ') || line.includes('ユウキ')) && 
        (line.includes('**') || line.includes(':') || line.includes('：'))
      );
      console.log('包含说话者标记的行数:', speakerLines.length);
      speakerLines.slice(0, 5).forEach((line, i) => {
        console.log(`行${i}: "${line.trim()}"`);
      });
    } else {
      // 显示找到的片段预览
      segments.slice(0, 3).forEach((seg, i) => {
        console.log(`片段${i + 1} [${seg.name}]: ${seg.text.substring(0, 30)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ 对话解析异常:', error.message);
    return [];
  }
  
  return segments;
}

// MiniMax语音合成函数 - 修复版本
async function generateAudio(text, voiceId, segmentId) {
  const fallbackVoiceId = 'male-qn-qingse'; // 官方稳定男声ID，回退用
  console.log(`🔊 开始为片段${segmentId}生成音频，语音ID: ${voiceId}`);
  console.log(`📝 文本长度: ${text.length}`);
  
  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
  const GROUP_ID = '1869812095596368162'; // 你提供的GroupId
  
  if (!MINIMAX_API_KEY) {
    throw new Error('MiniMax API Key未配置');
  }
  
  try {
    const baseRequest = {
      model: 'speech-02-hd',
      text: text,
      stream: false,
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1
      }
    };

    async function tryVoice(id) {
      const requestBody = {
        ...baseRequest,
        voice_setting: {
          voice_id: id,
          speed: 1,
          vol: 1,
          pitch: 0
        }
      };

      const maxRetries = 5;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🚀 MiniMax 合成请求（voice=${id}）第 ${attempt} 次`);
        const resp = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${GROUP_ID}` ,{
          method:'POST',
          headers:{'Authorization':`Bearer ${MINIMAX_API_KEY}`,'Content-Type':'application/json'},
          body: JSON.stringify(requestBody)
        });
        const data = await resp.json();
        if (data.base_resp?.status_code===0 && data.data?.audio){
          const buf = Buffer.from(data.data.audio,'hex');
          return {success:true,audioUrl:`data:audio/mp3;base64,${buf.toString('base64')}`,duration:data.extra_info?.audio_length||Math.ceil(text.length/10)};
        }
        await new Promise(r=>setTimeout(r,1000));
      }
      return {success:false,error:'no audio'};
    }

    // 先尝试主voiceId
    let result = await tryVoice(voiceId);
    if(!result.success && voiceId!==fallbackVoiceId){
      console.log('⚠️ 主voice失败，尝试备用voiceId');
      result = await tryVoice(fallbackVoiceId);
    }
    return result;
  } catch (error) {
    console.error(`❌ 片段${segmentId}音频生成失败:`, error.message);
    return {
      audioUrl: null,
      duration: 0,
      success: false,
      error: error.message
    };
  }
}

// 使用 ffmpeg-static 将多个 mp3 片段顺序拼接
async function mergeSegmentsFFmpeg(segments) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const tmpDir = '/tmp';
  const listFilePath = path.join(tmpDir, 'inputs.txt');

  // 写每个片段文件并生成列表
  const listLines = [];
  for (let i = 0; i < segments.length; i++) {
    const base64 = segments[i].audioUrl.split(',')[1];
    const filePath = path.join(tmpDir, `seg_${i}.mp3`);
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
    listLines.push(`file '${filePath}'`);
  }
  await fs.writeFile(listFilePath, listLines.join('\n'));

  const outputPath = path.join(tmpDir, 'output.mp3');

  // 若 ffmpeg-static 未打包进来，则直接拼接 Buffer
  if (!ffmpegPath) {
    console.warn('⚠️ ffmpeg-static 未找到，使用 Buffer.concat 合并');
    const buffers = segments.map(s => Buffer.from(s.audioUrl.split(',')[1], 'base64'));
    const merged = Buffer.concat(buffers);
    return `data:audio/mp3;base64,${merged.toString('base64')}`;
  }

  // 运行 ffmpeg concat，若报错则回退
  try {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  } catch (spawnErr) {
    console.error('ffmpeg 调用失败，回退 Buffer.concat:', spawnErr.message);
    const buffers = segments.map(s => Buffer.from(s.audioUrl.split(',')[1], 'base64'));
    const merged = Buffer.concat(buffers);
    return `data:audio/mp3;base64,${merged.toString('base64')}`;
  }

  let outBuf;
  try {
    outBuf = await fs.readFile(outputPath);
  } catch (e) {
    console.error('读取ffmpeg输出失败，回退Buffer拼接:', e.message);
    const buffers = segments.map(s=>Buffer.from(s.audioUrl.split(',')[1],'base64'));
    outBuf = Buffer.concat(buffers);
  }
  return `data:audio/mp3;base64,${outBuf.toString('base64')}`;
} 