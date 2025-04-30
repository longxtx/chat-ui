import { Message } from '../hooks/use-chat'
import { processStream } from '../utils/stream-helpers'

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        ...body
      }),
      signal: controller?.signal
    })

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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: messagesToSend,
      ...body
    })
  })
    .then(response => {
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