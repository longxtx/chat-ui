import { useCallback, useState } from 'react'
import { createEmptyAssistantMessage, processStream } from '../utils/stream-helpers'

export interface Message {
  id?: string
  content: string
  role: 'user' | 'assistant' | 'system'
  reasoning?: string
  sources?: Array<{name: string, url: string}>
}

type ChatData = Record<string, unknown>

interface UseChatOptions {
  initialMessages?: Message[]
  id?: string
  body?: Record<string, unknown>
  onFinish?: (message: Message) => void
  onError?: (error: Error) => void
  sendExtraMessageFields?: boolean
}

export function useChat({
  initialMessages = [],
  id: _id, // eslint-disable-line @typescript-eslint/no-unused-vars
  body,
  onFinish,
  onError,
  sendExtraMessageFields: _sendExtraMessageFields // eslint-disable-line @typescript-eslint/no-unused-vars
}: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<ChatData | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>()
  const [reasoning, setReasoning] = useState<string>('')
  // 用于内部追踪完整内容
  const [_completedContent, _setCompletedContent] = useState<string>('') // eslint-disable-line @typescript-eslint/no-unused-vars
  // 用于中止请求的控制器
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
    },
    []
  )

  const append = useCallback((message: Message) => {
    setMessages(msgs => [...msgs, message])
  }, [])

  // 用于追踪 reader 状态
  const [reader, setReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const stop = useCallback(() => {
    setIsLoading(false)
    // 中止正在进行的请求
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    // 关闭流
    if (reader) {
      reader.cancel().catch(console.error)
      setReader(null)
    }
  }, [abortController, reader])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      if (!input.trim()) {
        return
      }

      const userMessage: Message = {
        role: 'user',
        content: input
      }

      // 添加用户消息到对话
      append(userMessage)

      // 清空输入框和思考过程
      setInput('')
      setReasoning('')
      _setCompletedContent('')

      // 设置加载状态
      setIsLoading(true)

      try {
        // 构建传递给API的消息数组
        const messagesToSend = [...messages, userMessage]

        // 创建新的AbortController用于此次请求
        const controller = new AbortController()
        setAbortController(controller)

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: messagesToSend,
            ...body
          }),
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // 临时存储助手消息，用于追踪和更新
        const assistantMessage = createEmptyAssistantMessage()
        append(assistantMessage)

        // 处理事件流
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法读取响应流')
        }
        
        // 保存reader状态以便可以中止
        setReader(reader)
        
        // 使用共享的流处理函数
        await processStream(reader, {
          setMessages,
          setReasoning,
          setCompletedContent: _setCompletedContent
        })

        setIsLoading(false)
        // 获取最后一条消息
        const lastMessage = messages[messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          onFinish?.(lastMessage)
        }
      } catch (err) {
        setIsLoading(false)
        const error = err as Error
        setError(error)
        onError?.(error)
      }
    },
    [input, messages, append, body, onFinish, onError]
  )

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    data,
    setData,
    error,
    append,
    stop,
    setMessages,
    reasoning,
    setIsLoading
  }
}
