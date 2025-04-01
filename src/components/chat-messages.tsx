'use client'

import { Message } from '@/lib/hooks/use-chat'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

export function ChatMessages({
  messages,
  data: _data, // eslint-disable-line @typescript-eslint/no-unused-vars
  onQuerySelect: _onQuerySelect, // eslint-disable-line @typescript-eslint/no-unused-vars
  isLoading,
  chatId: _chatId, // eslint-disable-line @typescript-eslint/no-unused-vars
  onRegenerate
}: {
  messages: Message[]
  data?: unknown
  onQuerySelect: (query: string) => void
  isLoading: boolean
  chatId: string
  onRegenerate?: () => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showReasoning, setShowReasoning] = useState(true)
  const [showReferences, setShowReferences] = useState(true)
  const [tooltipMessage, setTooltipMessage] = useState('')
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [welcomeTitle, setWelcomeTitle] = useState('欢迎使用聊天应用')
  const [welcomeMessage, setWelcomeMessage] = useState('开始一个新的对话，发送消息开始聊天吧。')

  // 从API获取欢迎消息配置和应用配置
  useEffect(() => {
    // 显示推理过程
    const showProcess = process.env.NEXT_PUBLIC_SHOW_PROCESS === 'true'
    // 显示参考来源
    const showReferences = process.env.NEXT_PUBLIC_SHOW_REFERENCES === 'true'
    console.log('SHOW_PROCESS:', showProcess)
    // 欢迎消息配置
    const welcomeTitle = process.env.NEXT_PUBLIC_WELCOME_TITLE || '欢迎使用聊天应用'
    // 显示话题说明
    const welcomeMessage = process.env.NEXT_PUBLIC_WELCOME_MESSAGE || '开始一个新的对话，发送消息开始聊天吧。'


    if (localStorage.getItem('showProcess') === null) {
      setShowReasoning(showProcess)
    }
    setShowReferences(showReferences)
    setWelcomeTitle(welcomeTitle)
    setWelcomeMessage(welcomeMessage)

    const fetchUserinfo = async () => {
      try {
        // 获取欢迎消息配置
        const userinfoResponse = await fetch('/api/userinfo')
        if (userinfoResponse.ok) {
          const userData = await userinfoResponse.json()
          console.log('UserName:', userData.username)
          console.log('UserEmail:', userData.email)
          console.log('UserID:', userData.id)
          console.log('UserRole:', userData.is_admin)

        }
        
      } catch (error) {
        console.error('获取用户信息失败:', error)
      }
    }
    fetchUserinfo()
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // 清理Markdown内容，提供更好的渲染
  const cleanMarkdown = (text: string) => {
    if (!text) return ''

    // 第一步：处理HTML标签和Markdown标记
    let cleanedText = text
      .replace(/\*\*\s*\*\*/g, '**') // 处理连续的星号
      .replace(/\*\*\s+<strong>/g, '**') // 处理**后面跟着<strong>的情况
      .replace(/<\/strong>\s+\*\*/g, '**') // 处理</strong>后面跟着**的情况
      .replace(/<\/?strong>/g, '**') // 将<strong>标签替换为markdown **
      .replace(/^\s*#+\s*(.+)/gm, (_, title) => `# ${title}`) // 标准化标题格式
      .replace(/---+/g, '---') // 标准化分隔线
      .replace(/^(\s*[-*+])\s+/gm, '$1 ') // 标准化列表格式

    // 第二步：处理连续重复的单词和符号
    // 使用正则表达式匹配重复的单词和标点
    const repeatedWordPattern = /(\b\w+\b)(\s+\1\b)+/g
    const repeatedPunctPattern = /(（+|）+|，+|：+|。+|、+|\s+)+/g

    cleanedText = cleanedText
      .replace(repeatedWordPattern, '$1') // 处理重复的单词
      .replace(repeatedPunctPattern, '$1') // 处理重复的标点

    // 第三步：处理特殊情况，如重复的中文字符
    cleanedText = cleanedText
      .replace(/([一-龥])\1+/g, '$1') // 处理重复的中文字符
      .replace(/(\w+)\1+/g, '$1') // 处理英文中的连续重复(如DeepDeepSeek)

    // 确保换行符能够正确显示
    // 将\n转换为实际的换行，同时确保连续的换行符不会被重复
    cleanedText = cleanedText
      .replace(/\\n/g, '\n') // 替换字符串中的"\n"为实际的换行符
      .replace(/\n{3,}/g, '\n\n') // 限制连续换行不超过两个

    // 修复Markdown表格格式，确保表格能正确渲染
    cleanedText = fixMarkdownTables(cleanedText)

    return cleanedText
  }

  // 增强的修复Markdown表格函数
  const fixMarkdownTables = (text: string): string => {
    // 如果文本中不包含表格的可能性特征，则直接返回
    if (!text.includes('|')) return text

    // 检查是否有特别多的分隔线，如果有，可能是ASCII表格，需要特殊处理
    if ((text.match(/\-{3,}/g) || []).length > 5) {
      return convertAsciiTableToMarkdown(text)
    }

    // 提取出可能的表格区域（以|开头的行）
    const lines = text.split('\n')
    let inTable = false
    let tableStartIndex = -1
    const tables = []

    // 第一步：识别表格
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // 检测表格的开始（包含|）
      if (!inTable && line.includes('|')) {
        inTable = true
        tableStartIndex = i
      }
      // 检测表格的结束（不包含|或空行）
      else if (inTable && (!line.includes('|') || line === '')) {
        inTable = false
        tables.push({ start: tableStartIndex, end: i - 1 })
      }
    }

    // 如果最后一个表格没有结束，则添加到末尾
    if (inTable) {
      tables.push({ start: tableStartIndex, end: lines.length - 1 })
    }

    // 第二步：修复每个表格
    for (const table of tables) {
      const { start, end } = table
      // 确保表格至少有两行
      if (end - start < 1) continue

      // 第三步：准备表格行，移除干扰字符
      for (let i = start; i <= end; i++) {
        if (i >= lines.length) continue

        // 清理行，保留|和内容
        let line = lines[i].trim()

        // 跳过空行和只有分隔符的行
        if (line === '' || /^[\s\-|]*$/.test(line)) {
          continue
        }

        // 确保行以|开始和结束
        if (!line.startsWith('|')) line = '| ' + line
        if (!line.endsWith('|')) line = line + ' |'

        lines[i] = line
      }

      // 第四步：确保有表头分隔行
      // 获取第一行中的列数
      const headerLine = lines[start].trim()
      const columnCount = (headerLine.match(/\|/g) || []).length - 1

      // 检查第二行是否是分隔行
      if (start + 1 <= end) {
        const secondLine = lines[start + 1].trim()
        if (!secondLine.includes('-')) {
          // 添加分隔行
          const separator = '|' + Array(columnCount).fill('---|').join('') + '|'
          lines.splice(start + 1, 0, separator)
          // 调整表格结束索引
          table.end += 1
          // 更新后续表格的索引
          for (let j = tables.indexOf(table) + 1; j < tables.length; j++) {
            tables[j].start += 1
            tables[j].end += 1
          }
        }
      }
    }

    return lines.join('\n')
  }

  // 将ASCII风格的表格转换为Markdown表格
  const convertAsciiTableToMarkdown = (text: string): string => {
    const lines = text.split('\n')
    const result = []
    let inTable = false
    let headerRow = -1

    // 遍历每一行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // 检测表格边界行
      if (line.match(/^[\|\+][\-\=\+]+[\|\+]$/)) {
        // 这是表格的分隔行
        if (!inTable) {
          inTable = true
          headerRow = i + 1
        } else if (headerRow === i - 1) {
          // 如果这是头部分隔行，添加markdown分隔行
          const cellCount =
            (line.match(/\+/g) || []).length - 1 ||
            (line.match(/\|/g) || []).length - 1
          if (cellCount > 0) {
            const markdownSeparator =
              '|' + Array(cellCount).fill(' --- ').join('|') + '|'
            result.push(markdownSeparator)
          }
        }
        continue
      }

      // 处理表格内容行
      if (inTable && line.includes('|')) {
        // 提取单元格内容
        const cells = line.split('|').map(cell => cell.trim())
        // 只保留非空单元格
        const nonEmptyCells = cells.filter(cell => cell !== '')
        if (nonEmptyCells.length > 0) {
          const markdownRow = '|' + nonEmptyCells.join('|') + '|'
          result.push(markdownRow)
        }
        continue
      }

      // 表格结束
      if (
        inTable &&
        !line.includes('|') &&
        !line.match(/^[\|\+][\-\=\+]+[\|\+]$/)
      ) {
        inTable = false
      }

      // 非表格行直接添加
      if (!inTable) {
        result.push(line)
      }
    }

    return result.join('\n')
  }

  // 预处理reasoning内容，保留换行
  const preprocessReasoning = (text: string) => {
    if (!text) return ''

    // 首先清理Markdown
    const cleaned = cleanMarkdown(text)

    // 确保换行被正确处理
    // 在Markdown中，需要两个换行才能显示为段落分隔
    return cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n\n')
  }

  // 直接渲染HTML表格
  const renderHTMLTable = (tableContent: string) => {
    // 如果检测到包含表格标记的内容，直接使用HTML渲染
    if (tableContent.includes('|') && tableContent.includes('\n')) {
      try {
        // 从原始内容中提取表格和非表格部分，并按顺序保存
        const contentSegments = []

        let currentText = ''
        let currentTable = ''
        let inTable = false

        const lines = tableContent.trim().split('\n')

        // 遍历每一行，识别表格部分和文本部分
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()

          // 检测表格的开始（包含|且不是markdown列表）
          if (!inTable && line.includes('|') && !line.match(/^\s*-\s+/)) {
            // 如果之前有文本内容，添加到段落
            if (currentText.trim()) {
              contentSegments.push({
                type: 'text',
                content: currentText.trim()
              })
              currentText = ''
            }

            inTable = true
            currentTable = line + '\n'
          }
          // 检测表格的结束
          else if (
            inTable &&
            (!line.includes('|') || line === '' || line.match(/^\s*#/))
          ) {
            // 添加表格段落
            if (currentTable.trim()) {
              contentSegments.push({
                type: 'table',
                content: currentTable.trim()
              })
              currentTable = ''
            }

            inTable = false
            currentText = line ? line + '\n' : '\n'
          }
          // 继续收集当前区块内容
          else {
            if (inTable) {
              currentTable += line + '\n'
            } else {
              currentText += line + '\n'
            }
          }
        }

        // 处理最后的内容
        if (inTable && currentTable.trim()) {
          contentSegments.push({
            type: 'table',
            content: currentTable.trim()
          })
        } else if (currentText.trim()) {
          contentSegments.push({
            type: 'text',
            content: currentText.trim()
          })
        }

        // 如果没有检测到任何内容，返回null
        if (contentSegments.length === 0) {
          return null
        }

        // 渲染所有内容段落，按照原始顺序
        const elements = contentSegments.map((segment, idx) => {
          if (segment.type === 'text') {
            // 渲染文本内容
            return (
              <div key={`text-${idx}`}>
                <ReactMarkdown
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    pre: ({ children }) => (
                      <div className="overflow-auto my-2">{children}</div>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                        {children}
                      </code>
                    ),
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold mb-4">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold mb-3">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-bold mb-2">{children}</h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-base font-bold mb-2">{children}</h4>
                    ),
                    h5: ({ children }) => (
                      <h5 className="text-sm font-bold mb-1">{children}</h5>
                    ),
                    h6: ({ children }) => (
                      <h6 className="text-xs font-bold mb-1">{children}</h6>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc ml-5 mb-4">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal ml-5 mb-4">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-bold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    hr: () => (
                      <hr className="my-4 border-gray-200 dark:border-gray-700" />
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-blue-500 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 italic my-4">
                        {children}
                      </blockquote>
                    )
                  }}
                >
                  {segment.content}
                </ReactMarkdown>
              </div>
            )
          } else if (segment.type === 'table') {
            // 渲染表格内容
            try {
              const tableLines = segment.content.trim().split('\n')

              // 确保表格有标题行和分隔行
              if (tableLines.length < 2) {
                return (
                  <div key={`text-table-fallback-${idx}`}>
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                      {segment.content}
                    </ReactMarkdown>
                  </div>
                )
              }

              // 表头行
              const headerLine = tableLines[0]
              const headers = headerLine
                .split('|')
                .filter(cell => cell.trim() !== '')
                .map(cell => cell.trim().replace(/^\*\*(.*)\*\*$/, '$1')) // 处理粗体标记

              // 检查是否有分隔行
              let dataStartIndex = 1
              if (tableLines[1] && tableLines[1].includes('-')) {
                dataStartIndex = 2
              } else {
                // 添加分隔行以确保Markdown表格格式正确
                const separator =
                  '|' + Array(headers.length).fill('---|').join('') + '|'
                tableLines.splice(1, 0, separator)
                dataStartIndex = 2
              }

              // 数据行
              const rows = tableLines.slice(dataStartIndex).map(line => {
                const cells = line
                  .split('|')
                  .filter(cell => cell.trim() !== '')
                  .map(cell => {
                    // 处理单元格中的Markdown标记
                    return cell
                      .trim()
                      .replace(/^\*\*(.*)\*\*$/, '$1') // 移除粗体标记用于渲染
                      .replace(/^\*(.*)\*$/, '$1') // 移除斜体标记用于渲染
                  })
                return cells
              })

              return (
                <div key={`table-${idx}`} className="overflow-x-auto my-4">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 table-auto border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        {headers.map((header, headerIdx) => (
                          <th
                            key={headerIdx}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-700"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                      {rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          {row.map((cell, cellIdx) => {
                            // 判断是否为表头单元格（第一列或包含特定格式的单元格）
                            const isHeaderCell =
                              cellIdx === 0 ||
                              cell.startsWith('**') ||
                              cell.match(/^[A-Z\s]+$/)

                            return (
                              <td
                                key={cellIdx}
                                className={`px-3 py-2 whitespace-normal text-sm border-b dark:border-gray-700 ${
                                  isHeaderCell ? 'font-medium' : ''
                                }`}
                              >
                                {/* 处理单元格中可能的简单Markdown */}
                                <ReactMarkdown
                                  rehypePlugins={[rehypeSanitize]}
                                  components={{
                                    p: ({ children }) => <>{children}</>,
                                    strong: ({ children }) => (
                                      <strong className="font-bold">
                                        {children}
                                      </strong>
                                    ),
                                    em: ({ children }) => (
                                      <em className="italic">{children}</em>
                                    )
                                  }}
                                >
                                  {cell}
                                </ReactMarkdown>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            } catch {
              // 如果表格处理失败，添加原始文本
              return (
                <div key={`fallback-${idx}`}>
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                    {segment.content}
                  </ReactMarkdown>
                </div>
              )
            }
          }

          return null
        })

        // 直接返回所有元素，包括表格和表格之间的文本
        return <>{elements}</>
      } catch (error) {
        console.error('Error rendering HTML table:', error)
        // 如果渲染失败，回退到普通Markdown渲染
        return (
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {tableContent}
          </ReactMarkdown>
        )
      }
    }
    return null
  }

  // 保存用户的显示设置到localStorage
  const toggleShowReasoning = () => {
    const newValue = !showReasoning;
    setShowReasoning(newValue);
    // 保存用户设置到localStorage
    localStorage.setItem('showProcess', JSON.stringify(newValue));
  }

  // 从localStorage读取用户设置
  useEffect(() => {
    const savedSetting = localStorage.getItem('showProcess');
    if (savedSetting !== null) {
      setShowReasoning(JSON.parse(savedSetting));
    }
  }, []);

  return (
    <div className="relative px-4">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleShowReasoning}
          className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center shadow-md"
          title={showReasoning ? '隐藏思考过程' : '显示思考过程'}
          aria-label="切换显示思考过程"
        >
          {showReasoning ? <FaEye size={16} /> : <FaEyeSlash size={16} />}
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{welcomeTitle}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {welcomeMessage}
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message, index) => {
            const isUser = message.role === 'user'
            // 检测是否包含表格，用于决定是否使用自定义表格渲染
            const hasTable =
              !isUser &&
              message.content &&
              // 标准表格检测
              ((message.content.includes('|') &&
                (message.content.match(/\n/g) || []).length > 2) ||
                // ASCII表格检测
                (message.content.includes('+-') &&
                  message.content.includes('-+')) ||
                // 大量分隔线检测
                ((message.content.match(/\-{3,}/g) || []).length > 4 &&
                  message.content.includes('|')))

            // 检测内容是否包含Markdown标记 - 用于未来功能扩展
            const _hasMarkdownFormatting = // eslint-disable-line @typescript-eslint/no-unused-vars
              !isUser &&
              message.content &&
              (message.content.includes('**') || // 粗体
                message.content.includes('# ') || // 标题
                message.content.includes('- ') || // 列表
                message.content.includes('1. ') || // 有序列表
                message.content.includes('> ') || // 引用
                (message.content.includes('[') &&
                  message.content.includes(']('))) // 链接

            // 预处理表格内容
            const tableContent = hasTable ? cleanMarkdown(message.content) : ''
            // 尝试直接渲染HTML表格
            const htmlTable = hasTable ? renderHTMLTable(tableContent) : null

            return (
              <div key={index} className="mb-4">
                {/* 用户消息 */}
                {isUser && (
                  <div className="flex justify-end">
                    <div className="rounded-lg px-4 py-2 max-w-[80%] bg-blue-500 text-white text-sm">
                      <div>{message.content}</div>
                    </div>
                  </div>
                )}

                {/* AI助手消息 */}
                {!isUser && (
                  <div className="space-y-2">
                    {/* 思考过程 */}
                    {showReasoning && message.reasoning && (
                      <div className="flex justify-start relative">
                        {/* 添加机器人图标到思考过程框 */}
                        <div className="absolute -left-10 -top-2 w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-zinc-800 border-2 border-yellow-200 dark:border-yellow-700 shadow-sm">
                          <Image
                            src="/robot-logo.png"
                            alt="AI思考"
                            width={32}
                            height={32}
                            className="object-cover opacity-70"
                          />
                        </div>
                        <div className="rounded-lg px-4 py-2 max-w-[90%] bg-white dark:bg-zinc-800 text-[#8b8b8b] dark:text-zinc-400 text-xs font-mono border border-gray-200 dark:border-zinc-700 shadow-sm">
                          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
                            <ReactMarkdown
                              rehypePlugins={[rehypeSanitize]}
                              components={{
                                pre: ({ children }) => (
                                  <div className="overflow-auto my-2">
                                    {children}
                                  </div>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                                    {children}
                                  </code>
                                ),
                                p: ({ children }) => (
                                  <p className="mb-2">{children}</p>
                                ),
                                h1: ({ children }) => (
                                  <h1 className="text-xl font-bold mb-3">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-lg font-bold mb-2">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-base font-bold mb-2">
                                    {children}
                                  </h3>
                                ),
                                h4: ({ children }) => (
                                  <h4 className="text-sm font-bold mb-1">
                                    {children}
                                  </h4>
                                ),
                                h5: ({ children }) => (
                                  <h5 className="text-xs font-bold mb-1">
                                    {children}
                                  </h5>
                                ),
                                h6: ({ children }) => (
                                  <h6 className="text-xs font-bold mb-1">
                                    {children}
                                  </h6>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc ml-5 mb-3">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal ml-5 mb-3">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="mb-1">{children}</li>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-bold">
                                    {children}
                                  </strong>
                                ),
                                em: ({ children }) => (
                                  <em className="italic">{children}</em>
                                ),
                                hr: () => (
                                  <hr className="my-3 border-gray-200 dark:border-gray-700" />
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    className="text-blue-500 hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 italic my-3">
                                    {children}
                                  </blockquote>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-4">
                                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border-collapse">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({ children }) => (
                                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                    {children}
                                  </tbody>
                                ),
                                tr: ({ children }) => (
                                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    {children}
                                  </tr>
                                ),
                                th: ({ children }) => (
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-700">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-3 py-2 whitespace-normal text-sm border-b dark:border-gray-700">
                                    {children}
                                  </td>
                                )
                              }}
                            >
                              {preprocessReasoning(message.reasoning)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 响应内容 - 如果有表格，使用自定义表格渲染 */}
                    <div className="flex justify-start relative">
                      {/* 添加机器人图标 */}
                      <div className="absolute -left-10 -top-2 w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 shadow-sm">
                        <Image
                          src="/robot-logo.png"
                          alt="AI助手"
                          width={32}
                          height={32}
                          className="object-cover"
                        />
                      </div>
                      <div className="rounded-lg px-4 py-2 max-w-[80%] bg-white dark:bg-zinc-800 text-black dark:text-zinc-200 relative text-sm border border-gray-200 dark:border-zinc-700 shadow-sm">
                        <div className="prose prose-xs dark:prose-invert max-w-none">
                          {htmlTable ? (
                            htmlTable
                          ) : (
                            <ReactMarkdown
                              rehypePlugins={[rehypeSanitize]}
                              components={{
                                pre: ({ children }) => (
                                  <div className="overflow-auto my-2">
                                    {children}
                                  </div>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                                    {children}
                                  </code>
                                ),
                                p: ({ children }) => (
                                  <p className="mb-2">{children}</p>
                                ),
                                h1: ({ children }) => (
                                  <h1 className="text-xl font-bold mb-4">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-lg font-bold mb-3">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-base font-bold mb-2">
                                    {children}
                                  </h3>
                                ),
                                h4: ({ children }) => (
                                  <h4 className="text-sm font-bold mb-2">
                                    {children}
                                  </h4>
                                ),
                                h5: ({ children }) => (
                                  <h5 className="text-sm font-bold mb-1">
                                    {children}
                                  </h5>
                                ),
                                h6: ({ children }) => (
                                  <h6 className="text-xs font-bold mb-1">
                                    {children}
                                  </h6>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc ml-5 mb-4">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal ml-5 mb-4">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="mb-1">{children}</li>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-bold">
                                    {children}
                                  </strong>
                                ),
                                em: ({ children }) => (
                                  <em className="italic">{children}</em>
                                ),
                                hr: () => (
                                  <hr className="my-4 border-gray-200 dark:border-gray-700" />
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    className="text-blue-500 hover:underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 italic my-4">
                                    {children}
                                  </blockquote>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-4">
                                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border-collapse">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-gray-100 dark:bg-gray-800">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({ children }) => (
                                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                    {children}
                                  </tbody>
                                ),
                                tr: ({ children }) => (
                                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    {children}
                                  </tr>
                                ),
                                th: ({ children }) => (
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-700">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-3 py-2 whitespace-normal text-sm border-b dark:border-gray-700">
                                    {children}
                                  </td>
                                )
                              }}
                            >
                              {cleanMarkdown(message.content)}
                            </ReactMarkdown>
                          )}
                        </div>

                        {/* 功能按钮区域 - 仅在消息已完成加载且有内容时显示 */}
                        {message.role === 'assistant' &&
                          message.content &&
                          !isLoading &&
                          index === messages.length - 1 && (
                            <div className="absolute bottom-[-30px] left-0 flex space-x-2">
                              {/* 复制按钮 */}
                              <button
                                onClick={() => {
                                  navigator.clipboard
                                    .writeText(message.content)
                                    .then(() => {
                                      setTooltipMessage('已复制到剪贴板')
                                      setTooltipVisible(true)
                                      setTimeout(
                                        () => setTooltipVisible(false),
                                        2000
                                      )
                                    })
                                    .catch(() => {
                                      setTooltipMessage('复制失败')
                                      setTooltipVisible(true)
                                      setTimeout(
                                        () => setTooltipVisible(false),
                                        2000
                                      )
                                    })
                                }}
                                className="p-1 bg-gray-100 dark:bg-zinc-800 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                                aria-label="复制回复内容"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect
                                    x="9"
                                    y="9"
                                    width="13"
                                    height="13"
                                    rx="2"
                                    ry="2"
                                  ></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              </button>

                              {/* 重新生成按钮 */}
                              <button
                                onClick={onRegenerate}
                                className="p-1 bg-gray-100 dark:bg-zinc-800 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                                aria-label="重新生成回复"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 2v6h6"></path>
                                  <path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
                                </svg>
                              </button>

                              {/* 工具提示 */}
                              {tooltipVisible && (
                                <div className="absolute left-0 bottom-8 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                                  {tooltipMessage}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                    
                    {/* 参考文件源区域 - 显示在消息底部 */}
                    { showReferences && message.sources && message.sources.length > 0 && (
                      <div className={`${index === messages.length - 1 ? 'mt-8' : 'mt-2'} rounded-md py-2 mb-12`}>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">参考推理源：</p>
                        <div className="flex flex-wrap gap-2">
                          {message.sources.map((source, sourceIndex) => (
                            <a
                              key={sourceIndex}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-white dark:bg-zinc-700 px-2 py-1 rounded-md text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-zinc-600 transition-colors flex items-center gap-1 border border-gray-200 dark:border-zinc-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                              {source.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                )
                }
              </div>
            )
          })}

          {/* 加载指示器 */}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="rounded-lg px-4 py-2 max-w-[80%] bg-gray-200 dark:bg-zinc-700 dark:text-zinc-200">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  )
}
