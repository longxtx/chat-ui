'use client'

import { CHAT_ID } from '@/lib/constants'
import { Message, useChat } from '@/lib/hooks/use-chat'
import { authEvents, regenerateMessage } from '@/lib/services/chat-service'
import { Model } from '@/lib/types/models'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { LoginModal } from './login-modal'

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
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginCallback, setLoginCallback] = useState<(() => void) | null>(null)

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

  // 注册登录事件处理
  useEffect(() => {
    // 注册登录需求回调
    authEvents.onNeedLogin = (callback) => {
      setShowLoginModal(true)
      setLoginCallback(() => callback)
    }

    return () => {
      // 清理
      authEvents.onNeedLogin = null
    }
  }, [])

  // 处理登录成功
  const handleLoginSuccess = () => {
    setShowLoginModal(false)
    // 如果有回调，执行它
    if (loginCallback) {
      loginCallback()
      setLoginCallback(null)
    }
  }

  // 只在初始渲染或id变化时更新消息
  useEffect(() => {
    if (initialRenderRef.current) {
      setMessages(savedMessages)
      initialRenderRef.current = false
    }
  }, [id, setMessages]);

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

    // 将助手消息标记为正在重新生成
    const assistantMessageIndex = messages.length - 1 - lastAssistantIndex

    // 获取需要重新提交的用户消息
    const userMessageIndex = messages.length - 1 - lastUserIndex
    const userMessageToResend = messages[userMessageIndex]

    // 初始化一个新的API请求
    setData(undefined)

    // 向API发送请求，使用相同的用户消息触发新的回复
    if (userMessageToResend) {
      // 使用聊天服务重新生成消息
      regenerateMessage({
        messages,
        assistantMessageIndex,
        body: requestBody,
        setIsLoading,
        setMessages,
        onError: (error) => {
          toast.error(`重新生成失败: ${error.message}`)
        }
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
      
      {/* 登录模态框 */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
        onLoginSuccess={handleLoginSuccess} 
      />
    </div>
  )
}
