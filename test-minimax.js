// MiniMax API 测试脚本
async function testMiniMaxAPI() {
  console.log('🎙️ 开始测试MiniMax API...\n');

  // 测试配置
  const API_KEY = process.env.MINIMAX_API_KEY;
  const API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
  
  if (!API_KEY) {
    console.error('❌ 错误：未找到MINIMAX_API_KEY环境变量');
    return;
  }

  console.log('📋 测试配置:');
  console.log('- API Host:', API_HOST);
  console.log('- API Key:', API_KEY ? `${API_KEY.substring(0, 8)}...` : '未设置');
  console.log('');

  // 测试用的日语文本
  const testCase = {
    text: 'こんにちは、皆さん。今日は素晴らしい一日ですね。',
    voice_id: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a', // 女性
    description: '女性语音测试'
  };

  console.log(`🧪 测试: ${testCase.description}`);
  console.log(`📝 文本: ${testCase.text}`);
  console.log(`🎵 语音ID: ${testCase.voice_id}`);
  
  try {
    // 构建请求参数
    const payload = {
      model: 'speech-01-turbo',
      text: testCase.text,
      stream: false,
      voice_setting: {
        voice_id: testCase.voice_id,
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

    console.log('🚀 发送请求到MiniMax API...');
    console.log('📡 请求URL:', `${API_HOST}/v1/text_to_speech`);
    
    const response = await fetch(`${API_HOST}/v1/text_to_speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API调用成功！');
      console.log('📊 响应数据:', JSON.stringify(result, null, 2));
      
      if (result.task_id) {
        console.log(`- 任务ID: ${result.task_id}`);
        console.log('- 模式: 异步处理');
        
      } else if (result.audio_url) {
        console.log(`- 音频URL: ${result.audio_url}`);
        console.log('- 模式: 同步处理');
        console.log('🎉 音频生成成功！');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API调用失败:');
      console.log(`- 状态码: ${response.status}`);
      console.log(`- 响应头: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
      console.log(`- 错误信息: ${errorText}`);
    }

  } catch (error) {
    console.log('💥 请求异常:');
    console.log(`- 错误类型: ${error.name}`);
    console.log(`- 错误信息: ${error.message}`);
    console.log(`- Stack: ${error.stack}`);
  }
}

// 运行测试
testMiniMaxAPI().then(() => {
  console.log('🏁 测试完成');
}).catch(error => {
  console.error('💥 测试过程中发生错误:', error);
});
