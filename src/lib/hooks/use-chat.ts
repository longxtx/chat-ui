import { useCallback, useState } from 'react'
import { createEmptyAssistantMessage } from '../utils/stream-helpers'
import { sendChatMessage } from '../services/chat-service'

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

        // 临时存储助手消息，用于追踪和更新
        const assistantMessage = createEmptyAssistantMessage()
        append(assistantMessage)

        // 使用聊天服务发送消息
        await sendChatMessage({
          messages: messagesToSend,
          body,
          controller,
          onStart: (newReader) => {
            setReader(newReader)
          },
          onUpdate: {
            setMessages,
            setReasoning,
            setCompletedContent: _setCompletedContent
          },
          onFinish: () => {
            setIsLoading(false)
            // 获取最后一条消息
            const lastMessage = messages[messages.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              onFinish?.(lastMessage)
            }
          },
          onError: (err) => {
            setIsLoading(false)
            setError(err)
            onError?.(err)
          }
        })
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
