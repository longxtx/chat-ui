import { Message } from '../hooks/use-chat'
import { processStream } from '../utils/stream-helpers'

// 获取认证token并创建headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  // 确保代码在浏览器环境中运行
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  
  return headers
}

// 添加一个全局事件总线，用于触发登录框显示
export const authEvents = {
  // 当需要登录时触发
  onNeedLogin: null as ((callback: () => void) => void) | null,
}

/**
 * 发送聊天消息的参数接口
 */
interface SendChatMessageOptions {
  messages: Message[]
  body?: Record<string, unknown>
  controller?: AbortController
  onStart?: (reader: ReadableStreamDefaultReader<Uint8Array>) => void
  onUpdate?: {
    setMessages: (updater: (messages: Message[]) => Message[]) => void
    setReasoning?: (reasoning: string) => void
    setCompletedContent?: (content: string) => void
  }
  onFinish?: () => void
  onError?: (error: Error) => void
}

/**
 * 重新生成消息的参数接口
 */
interface RegenerateMessageOptions {
  messages: Message[]
  assistantMessageIndex: number
  body?: Record<string, unknown>
  setIsLoading: (loading: boolean) => void
  setMessages: (updater: (messages: Message[]) => Message[]) => void
  onError?: (error: Error) => void
}

/**
 * 发送聊天消息到API
 */
export async function sendChatMessage({
  messages,
  body = {},
  controller,
  onStart,
  onUpdate,
  onFinish,
  onError
}: SendChatMessageOptions): Promise<void> {
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        messages,
        ...body
      }),
      signal: controller?.signal
    })

    // 检查是否未登录（状态码401表示未授权）
    if (response.status === 401) {
      // 如果有注册的登录回调，则触发它
      if (authEvents.onNeedLogin) {
        // 创建一个Promise，等待登录成功后重试
        return new Promise((resolve) => {
          // 添加非空断言或条件检查
          if (authEvents.onNeedLogin) {
            authEvents.onNeedLogin(() => {
              // 登录成功后重新发送请求
              sendChatMessage({
                messages,
                body,
                controller,
                onStart,
                onUpdate,
                onFinish,
                onError
              }).then(resolve)
            })
          }
        })
      } else {
        throw new Error('需要登录才能继续')
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 处理事件流
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }
    
    // 通知调用者reader已准备好
    onStart?.(reader)
    
    // 使用共享的流处理函数
    await processStream(reader, {
      setMessages: onUpdate?.setMessages || (() => {}),
      setReasoning: onUpdate?.setReasoning,
      setCompletedContent: onUpdate?.setCompletedContent
    })

    onFinish?.()
  } catch (err) {
    const error = err as Error
    onError?.(error)
  }
}

/**
 * 重新生成消息
 */
export function regenerateMessage({
  messages,
  assistantMessageIndex,
  body = {},
  setIsLoading,
  setMessages,
  onError
}: RegenerateMessageOptions): void {
  // 创建一个请求，将历史消息直到但不包括最后一条助手消息
  const messagesToSend = messages.slice(0, assistantMessageIndex)

  // 设置加载状态
  setIsLoading(true)

  // 发送API请求
  fetch('/api/chat/stream', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      messages: messagesToSend,
      ...body
    })
  })
    .then(response => {
      // 检查是否未登录（状态码401表示未授权）
      if (response.status === 401) {
        // 如果有注册的登录回调，则触发它
        if (authEvents.onNeedLogin) {
          // 添加非空断言或条件检查
          if (authEvents.onNeedLogin) {
            authEvents.onNeedLogin(() => {
              // 登录成功后重新尝试
              regenerateMessage({
                messages,
                assistantMessageIndex,
                body,
                setIsLoading,
                setMessages,
                onError
              })
            })
          }
          return
        } else {
          throw new Error('需要登录才能继续')
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 处理返回的事件流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      // 更新消息状态，将助手消息内容清空，准备接收新内容
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages]
        if (assistantMessageIndex < updatedMessages.length) {
          updatedMessages[assistantMessageIndex] = {
            ...updatedMessages[assistantMessageIndex],
            content: '',
            reasoning: '',
            sources: []
          }
        }
        return updatedMessages
      })
      
      // 处理流式响应
      processStream(reader, {
        setMessages,
        messageIndex: assistantMessageIndex
      })
        .then(() => {
          setIsLoading(false)
        })
        .catch(error => {
          console.error('Error reading stream:', error)
          setIsLoading(false)
          onError?.(error)
        })
    })
    .catch(error => {
      console.error('Regeneration error:', error)
      setIsLoading(false)
      onError?.(error)
    })
}