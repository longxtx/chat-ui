'use client'

import { Message } from '@/lib/hooks/use-chat'
import { Model } from '@/lib/types/models'
import { useState } from 'react'

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setMessages: _setMessages,
  stop,
  query,
  append,
  models
}: {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  stop: () => void
  query?: string
  append: (message: Message) => void
  models?: Model[]
}) {
  const [selectedModel, setSelectedModel] = useState<string>(
    models?.[0]?.id || ''
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form && input.trim()) {
        handleSubmit(
          new Event('submit') as unknown as React.FormEvent<HTMLFormElement>
        )
      }
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-white dark:from-zinc-900 from-50% to-transparent pt-10 pb-5">
      <div className="max-w-3xl mx-auto px-4">
        {query && messages.length === 0 && (
          <div className="mb-4">
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
              onClick={() => {
                append({
                  role: 'user',
                  content: query
                })
              }}
            >
              使用建议的查询: {query}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="flex-grow relative">
            <textarea
              className="w-full resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-200"
              placeholder="输入消息...（按回车发送，Shift+回车换行）"
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              style={{
                minHeight: '60px',
                maxHeight: '200px'
              }}
            />
          </div>

          <div>
            {isLoading ? (
              <button
                onClick={stop}
                className="inline-flex items-center justify-center rounded-full w-12 h-12 bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
                type="button"
                aria-label="停止生成"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                className="inline-flex items-center justify-center rounded-full w-12 h-12 bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
                type="submit"
                disabled={!input.trim()}
                aria-label="发送消息"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            )}
          </div>
        </form>

        {models && models.length > 0 && (
          <div className="mt-2">
            <div className="flex space-x-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span>模型:</span>
              <div className="flex space-x-2">
                {models.map(model => (
                  <button
                    key={model.id}
                    className={`px-2 py-0.5 rounded ${
                      selectedModel === model.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
