export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed, use GET' });
  }

  try {
    console.log('🎙️ 开始测试MiniMax API...');

    // 测试配置
    const API_KEY = process.env.MINIMAX_API_KEY;
    const API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
    
    const testResults = {
      timestamp: new Date().toISOString(),
      config: {
        apiHost: API_HOST,
        apiKeyExists: !!API_KEY,
        apiKeyPreview: API_KEY ? `${API_KEY.substring(0, 8)}...` : '未设置'
      },
      tests: []
    };

    if (!API_KEY) {
      testResults.error = '未找到MINIMAX_API_KEY环境变量';
      return res.status(500).json(testResults);
    }

    // 测试用的日语文本
    const testCases = [
      {
        text: 'こんにちは、皆さん。今日は素晴らしい一日ですね。',
        voice_id: 'moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a', // 女性
        description: '女性语音测试'
      },
      {
        text: 'はい、そうですね。今日のテーマについて話し合いましょう。',
        voice_id: 'moss_audio_eabf88cc-4c59-11f0-b862-46ba4da2d9df', // 男性
        description: '男性语音测试'
      }
    ];

    for (const [index, testCase] of testCases.entries()) {
      console.log(`🧪 测试 ${index + 1}: ${testCase.description}`);
      
      const testResult = {
        testNumber: index + 1,
        description: testCase.description,
        text: testCase.text,
        voiceId: testCase.voice_id,
        startTime: new Date().toISOString()
      };

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
        
        const response = await fetch(`${API_HOST}/v1/text_to_speech`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        testResult.responseStatus = response.status;
        testResult.responseStatusText = response.statusText;
        testResult.endTime = new Date().toISOString();

        if (response.ok) {
          const result = await response.json();
          testResult.success = true;
          testResult.responseData = result;
          
          if (result.task_id) {
            testResult.mode = 'async';
            testResult.taskId = result.task_id;
            console.log(`✅ 测试 ${index + 1} 成功 - 异步任务ID: ${result.task_id}`);
            
          } else if (result.audio_url) {
            testResult.mode = 'sync';
            testResult.audioUrl = result.audio_url;
            console.log(`✅ 测试 ${index + 1} 成功 - 音频URL: ${result.audio_url}`);
          } else {
            testResult.mode = 'unknown';
            console.log(`⚠️ 测试 ${index + 1} 响应格式异常`);
          }
        } else {
          const errorText = await response.text();
          testResult.success = false;
          testResult.error = errorText;
          console.log(`❌ 测试 ${index + 1} API调用失败: ${response.status} - ${errorText}`);
        }

      } catch (error) {
        testResult.success = false;
        testResult.error = error.message;
        testResult.errorType = error.name;
        testResult.endTime = new Date().toISOString();
        console.log(`💥 测试 ${index + 1} 请求异常: ${error.message}`);
      }

      testResults.tests.push(testResult);
    }

    // 汇总结果
    const successful = testResults.tests.filter(t => t.success).length;
    const failed = testResults.tests.filter(t => !t.success).length;
    
    testResults.summary = {
      total: testResults.tests.length,
      successful,
      failed,
      successRate: `${((successful / testResults.tests.length) * 100).toFixed(1)}%`
    };

    console.log(`🏁 测试完成 - 成功: ${successful}, 失败: ${failed}`);

    res.status(200).json(testResults);

  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
    res.status(500).json({
      error: '测试失败',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 