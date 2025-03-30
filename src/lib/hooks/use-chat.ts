import { useCallback, useState } from 'react'

export interface Message {
  id?: string
  content: string
  role: 'user' | 'assistant' | 'system'
  reasoning?: string
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

  const stop = useCallback(() => {
    setIsLoading(false)
    // 中止正在进行的请求
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }, [abortController])

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
        const assistantMessage: Message = {
          role: 'assistant',
          content: '',
          reasoning: ''
        }
        append(assistantMessage)

        // 处理事件流
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法读取响应流')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let done = false
        let completedContent = ''

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading

          if (value) {
            buffer += decoder.decode(value, { stream: true })

            // 处理所有完整的数据行
            const lines = buffer.split('\n\n')
            buffer = lines.pop() || '' // 保留最后一个可能不完整的行

            for (const line of lines) {
              if (line.trim() === '') continue
              if (!line.startsWith('data: ')) continue

              const jsonString = line.substring(6) // 跳过 "data: "
              try {
                const data = JSON.parse(jsonString)

                if (data.type === 'reasoning') {
                  // 更新思考过程
                  const processedReasoning = data.content
                  setReasoning(processedReasoning)

                  // 更新消息中的reasoning字段
                  setMessages(currentMessages => {
                    const updatedMessages = [...currentMessages]
                    const lastMessage =
                      updatedMessages[updatedMessages.length - 1]
                    if (lastMessage.role === 'assistant') {
                      lastMessage.reasoning = processedReasoning
                    }
                    return updatedMessages
                  })
                } else if (data.type === 'content') {
                  // 累积内容以便后处理
                  completedContent += data.content
                  _setCompletedContent(completedContent)

                  const processedContent = completedContent

                  setMessages(currentMessages => {
                    const updatedMessages = [...currentMessages]
                    const lastMessage =
                      updatedMessages[updatedMessages.length - 1]
                    if (lastMessage.role === 'assistant') {
                      lastMessage.content = processedContent
                    }
                    return updatedMessages
                  })
                }
              } catch (e) {
                console.error('Error parsing event stream:', e)
              }
            }
          }
        }

        // 流处理完成后，对完整内容再次进行处理
        if (completedContent) {
          const finalProcessedContent = completedContent

          setMessages(currentMessages => {
            const updatedMessages = [...currentMessages]
            const lastMessage = updatedMessages[updatedMessages.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = finalProcessedContent
            }
            return updatedMessages
          })
        }

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
