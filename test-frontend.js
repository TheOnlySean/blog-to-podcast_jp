// 前端兼容性测试脚本
const testSinglePodcastResponse = {
    success: true,
    script: "こんにちは、皆さん。今日は素晴らしい一日ですね。",
    audioUrl: "https://example.com/audio.mp3",
    duration: 5,
    wordCount: 100,
    metadata: {
        voiceId: "moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a",
        language: "ja",
        isAsyncTask: false
    }
};

const testAsyncPodcastResponse = {
    success: true,
    script: "こんにちは、皆さん。今日は素晴らしい一日ですね。",
    taskId: "12345678-abcd-efgh-ijkl-123456789012",
    duration: 5,
    wordCount: 100,
    metadata: {
        voiceId: "moss_audio_d3f65edb-4c57-11f0-acba-96daea575b6a",
        language: "ja",
        isAsyncTask: true
    }
};

console.log('测试数据准备完成');
console.log('同步响应示例:', testSinglePodcastResponse);
console.log('异步响应示例:', testAsyncPodcastResponse); 