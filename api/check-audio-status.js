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
    const { taskIds } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: '请提供有效的任务ID数组' });
    }

    if (!process.env.MINIMAX_API_KEY) {
      return res.status(500).json({ error: '未配置MiniMax API Key' });
    }

    const minimaxHost = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
    
    // 并行检查所有任务状态
    const statusPromises = taskIds.map(async (taskId) => {
      try {
        const statusResponse = await fetch(`${minimaxHost}/v1/text_to_speech/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          }
        });
        
        if (statusResponse.ok) {
          const statusResult = await statusResponse.json();
          return {
            taskId,
            status: statusResult.status,
            audioUrl: statusResult.audio_url || null,
            errorMessage: statusResult.error_message || null,
            success: true
          };
        } else {
          const errorText = await statusResponse.text();
          console.error(`任务 ${taskId} 状态查询失败:`, errorText);
          return {
            taskId,
            status: 'error',
            errorMessage: errorText,
            success: false
          };
        }
      } catch (error) {
        console.error(`任务 ${taskId} 状态查询异常:`, error);
        return {
          taskId,
          status: 'error',
          errorMessage: error.message,
          success: false
        };
      }
    });

    const results = await Promise.all(statusPromises);

    // 统计结果
    const completed = results.filter(r => r.status === 'Success' && r.audioUrl).length;
    const failed = results.filter(r => r.status === 'Failed' || r.status === 'error').length;
    const processing = results.filter(r => r.status === 'Processing').length;

    res.status(200).json({
      success: true,
      results,
      summary: {
        total: results.length,
        completed,
        failed,
        processing
      }
    });

  } catch (error) {
    console.error('检查音频状态时发生错误:', error);
    res.status(500).json({
      error: '检查音频状态失败',
      details: error.message
    });
  }
} 