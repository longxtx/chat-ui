'use client'

import { CHAT_ID } from '@/lib/constants'
import { Message, useChat } from '@/lib/hooks/use-chat'
import { Model } from '@/lib/types/models'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({
  id,
  savedMessages = [],
  query,
  models
}: {
  id: string
  savedMessages?: Message[]
  query?: string
  models?: Model[]
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    stop,
    append,
    data,
    setData,
    setIsLoading
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id
    },
    onFinish: () => {
      window.history.replaceState({}, '', `/chat/${id}`)
    },
    onError: (error: Error) => {
      toast.error(`聊天错误: ${error.message}`)
    }
  })

  // 请求体
  const requestBody = {
    id
  }

  // 使用ref来追踪初始渲染
  const initialRenderRef = useRef(true)

  // 只在初始渲染或id变化时更新消息
  useEffect(() => {
    if (initialRenderRef.current || id) {
      setMessages(savedMessages)
      initialRenderRef.current = false
    }
  }, [id, setMessages])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // 确保在提交前输入不为空
    if (!input.trim()) {
      return
    }
    setData(undefined) // reset data to clear tool call
    handleSubmit(e)
  }

  // 重新生成上一条消息的功能
  const handleRegenerate = () => {
    if (messages.length < 2 || isLoading) return

    // 找到最后一个助手消息和用户消息
    const reversedMessages = [...messages].reverse()
    const lastAssistantIndex = reversedMessages.findIndex(
      m => m.role === 'assistant'
    )
    const lastUserIndex = reversedMessages.findIndex(m => m.role === 'user')

    // 确保找到了用户和助手消息
    if (lastAssistantIndex === -1 || lastUserIndex === -1) return

    // 将助手消息标记为正在重新生成（可选：添加UI指示）
    const assistantMessageIndex = messages.length - 1 - lastAssistantIndex

    // 获取需要重新提交的用户消息
    const userMessageIndex = messages.length - 1 - lastUserIndex
    const userMessageToResend = messages[userMessageIndex]

    // 初始化一个新的API请求
    setData(undefined)

    // 向API发送请求，使用相同的用户消息触发新的回复
    if (userMessageToResend) {
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
          ...requestBody
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
                reasoning: ''
              }
            }
            return updatedMessages
          })

          // 读取流数据的函数
          const decoder = new TextDecoder()
          let buffer = ''
          let completedContent = ''

          const readStream = async () => {
            try {
              const { value, done } = await reader.read()

              if (done) {
                // 流结束后，设置加载状态为false
                setIsLoading(false)
                return
              }

              buffer += decoder.decode(value, { stream: true })

              // 处理完整的数据行
              const lines = buffer.split('\n\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.trim() === '' || !line.startsWith('data: ')) continue

                const jsonString = line.substring(6) // 跳过 "data: "
                try {
                  const data = JSON.parse(jsonString)

                  if (data.type === 'reasoning') {
                    // 更新思考过程
                    setMessages(currentMessages => {
                      const updatedMessages = [...currentMessages]
                      if (assistantMessageIndex < updatedMessages.length) {
                        updatedMessages[assistantMessageIndex].reasoning =
                          data.content
                      }
                      return updatedMessages
                    })
                  } else if (data.type === 'content') {
                    // 累积内容
                    completedContent += data.content

                    // 更新消息内容
                    setMessages(currentMessages => {
                      const updatedMessages = [...currentMessages]
                      if (assistantMessageIndex < updatedMessages.length) {
                        updatedMessages[assistantMessageIndex].content =
                          completedContent
                      }
                      return updatedMessages
                    })
                  }
                } catch (e) {
                  console.error('Error parsing event stream:', e)
                }
              }

              // 继续读取流
              readStream()
            } catch (error) {
              console.error('Error reading stream:', error)
              setIsLoading(false)
            }
          }

          // 开始读取流
          readStream()
        })
        .catch(error => {
          console.error('Regeneration error:', error)
          setIsLoading(false)
          // 显示错误消息
          toast.error(`重新生成失败: ${error.message}`)
        })
    }
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-14 pb-60 mx-auto stretch">
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        onRegenerate={handleRegenerate}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
        models={models}
      />
    </div>
  )
}
