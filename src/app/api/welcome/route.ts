// 创建一个API端点，用于获取欢迎消息配置
export async function GET() {
  try {
    // 从环境变量中获取欢迎消息配置
    const welcomeTitle = process.env.WELCOME_TITLE || '欢迎使用聊天应用'
    const welcomeMessage = process.env.WELCOME_MESSAGE || '开始一个新的对话，发送消息开始聊天吧。'

    // 返回JSON响应
    return Response.json({
      title: welcomeTitle,
      message: welcomeMessage
    })
  } catch (error) {
    // 如果发生错误，返回500错误
    console.error(error)
    return new Response(JSON.stringify({ error: '获取欢迎消息失败' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}