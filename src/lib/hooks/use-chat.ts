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
    // 实际实现中这里应该有中止请求的逻辑
  }, [])

  // 增强的文本处理函数，更有针对性地处理中文重复
  const processText = (text: string): string => {
    if (!text) return ''

    // 用于检测重复项的函数
    const removeDuplicates = (input: string): string => {
      // 首先替换常见的重复符号
      let result = input
        .replace(/([,.!?，。！？、；：])\1+/g, '$1') // 重复标点
        .replace(/([（\()])\1+/g, '$1') // 重复括号
        .replace(/([）\)])\1+/g, '$1') // 重复括号

      // 处理连续重复的单个中文字符
      result = result.replace(/([一-龥])\1+/g, '$1')

      // 处理重复的中文词语（2-4个字符）
      const zhWords = result.match(/[一-龥]{2,4}/g) || []
      for (const word of zhWords) {
        if (word.length >= 2) {
          // 创建一个匹配连续重复词语的正则表达式
          const wordRegex = new RegExp(`(${word})\\s*\\1+`, 'g')
          result = result.replace(wordRegex, '$1')
        }
      }

      // 处理常见的重复短语模式（如"是是"、"的的"等）
      const commonPatterns = [
        '是是',
        '的的',
        '在在',
        '了了',
        '和和',
        '与与',
        '对对',
        '这这',
        '那那',
        '有有',
        '个个',
        '中中',
        '大大',
        '小小',
        '一一',
        '二二',
        '三三',
        '日日',
        '月月',
        '年年',
        '不不',
        '也也',
        '很很',
        '都都',
        '可可',
        '能能',
        '将将',
        '会会'
      ]

      for (const pattern of commonPatterns) {
        const patternRegex = new RegExp(pattern, 'g')
        result = result.replace(patternRegex, pattern.charAt(0))
      }

      return result
    }

    // 应用重复检测
    let processed = removeDuplicates(text)

    // 处理更复杂的重复情况，如词语间隔重复
    processed = processed
      // 处理重复的词语，如"中国中国"
      .replace(/([一-龥]{2,4})\s*\1/g, '$1')
      // 处理"最大的最大的"这种模式
      .replace(/([一-龥]+的)\s*\1/g, '$1')
      // 处理"位于位于"这种动词重复
      .replace(/([一-龥]{2}于)\s*\1/g, '$1')
      // 处理"主体主体"这种名词重复
      .replace(/([一-龥]{2}体)\s*\1/g, '$1')
      // 处理"地级市地级市"这种专有名词重复
      .replace(/([一-龥]{2,4}市)\s*\1/g, '$1')

    return processed
  }

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

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: messagesToSend,
            ...body
          })
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
                  // 处理接收到的思考过程
                  const processedReasoning = processText(data.content)
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

                  // 实时处理并更新消息内容
                  const processedContent = processText(completedContent)

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
          const finalProcessedContent = processText(completedContent)

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
