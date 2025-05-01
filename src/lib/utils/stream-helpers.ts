import { Message } from '../hooks/use-chat'

/**
 * 处理流式响应数据的类型
 */
export interface StreamData {
  type: 'reasoning' | 'content' | 'source' | 'status' | 'files'
  content: string | {
    fileName: string
    filePath: string
    [key: string]: unknown
  }
}

/**
 * 处理流式响应的配置选项
 */
export interface ProcessStreamOptions {
  /**
   * 更新消息列表的函数
   */
  setMessages: (updater: (messages: Message[]) => Message[]) => void
  /**
   * 设置推理内容的函数（可选）
   */
  setReasoning?: (reasoning: string) => void
  /**
   * 设置完整内容的函数（可选）
   */
  setCompletedContent?: (content: string) => void
  /**
   * 消息索引，用于更新特定消息（可选，默认为最后一条消息）
   */
  messageIndex?: number
  
}

/**
 * 处理单行流数据
 * @param line 数据行
 * @param options 处理选项
 * @param state 当前状态（完整内容和推理内容）
 * @returns 更新后的状态
 */
export function processStreamLine(
  line: string,
  options: ProcessStreamOptions,
  state: { completedContent: string; reasoningContent: string }
): { completedContent: string; reasoningContent: string } {
  if (line.trim() === '' || !line.startsWith('data: ')) return state
  const { setMessages, setReasoning, setCompletedContent } = options
  let { completedContent, reasoningContent } = state
  const streaming_type = process.env.NEXT_PUBLIC_STREAMING_TYPE
  try {
    const jsonString = line.substring(6) // 跳过 "data: "
    const data = JSON.parse(jsonString) as StreamData

    if (data.type === 'reasoning' || data.type === 'status') {

      if (data.type ==='status') {
        data.content= ' . '
      }
      // 更新推理内容
      if(streaming_type === 'chunked') {
        reasoningContent += typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
      }
      else{
        reasoningContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
      }
      
      setReasoning?.(reasoningContent)

      // 更新消息中的reasoning字段
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages]
        const targetIndex = options.messageIndex ?? updatedMessages.length - 1
        const targetMessage = updatedMessages[targetIndex]
        
        if (targetMessage && targetMessage.role === 'assistant') {
          targetMessage.reasoning = reasoningContent
        }
        return updatedMessages
      })
    } else if (data.type === 'content') {
      // 累积内容
      completedContent += data.content
      setCompletedContent?.(completedContent)

      // 更新消息内容
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages]
        const targetIndex = options.messageIndex ?? updatedMessages.length - 1
        const targetMessage = updatedMessages[targetIndex]
        
        if (targetMessage && targetMessage.role === 'assistant') {
          targetMessage.content = completedContent
        }
        return updatedMessages
      })
    } else if (data.type === 'source') {
      // 处理参考文件源信息
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages]
        const targetIndex = options.messageIndex ?? updatedMessages.length - 1
        const targetMessage = updatedMessages[targetIndex]
        
        if (targetMessage && targetMessage.role === 'assistant') {
          // 初始化sources数组（如果不存在）
          if (!targetMessage.sources) {
            targetMessage.sources = []
          }
          
          // 确保content是字符串类型
          if (typeof data.content !== 'string') {
            console.error('Expected string content for source type, got object')
            return updatedMessages
          }
          
          // 解析文件名和URL
          const content = data.content.trim()
          
          // 检查是否是URL行
          if (content.startsWith('http')) {
            // 获取最后添加的source
            const lastSourceIndex = targetMessage.sources.length - 1
            if (lastSourceIndex >= 0) {
              // 添加URL到最后一个source
              targetMessage.sources[lastSourceIndex].url = content
              
              // 检查是否已经存在相同文件名但URL为空的source
              // 这是为了防止重复显示相同的文件
              const fileName = targetMessage.sources[lastSourceIndex].name
              const duplicateIndex = targetMessage.sources.findIndex((s, idx) => 
                idx !== lastSourceIndex && s.name === fileName && !s.url
              )
              
              // 如果找到重复的，则移除它
              if (duplicateIndex !== -1) {
                targetMessage.sources.splice(duplicateIndex, 1)
              }
            }
          } else {
            // 检查是否已经存在相同文件名的source
            const existingIndex = targetMessage.sources.findIndex(s => s.name === content)
            
            // 如果不存在，则添加新的source（只有文件名）
            if (existingIndex === -1) {
              targetMessage.sources.push({
                name: content,
                url: ''
              })
            }
          }
        }
        return updatedMessages
      })
    } else if (data.type === 'files') {
      // 处理新格式的文件源信息
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages]
        const targetIndex = options.messageIndex ?? updatedMessages.length - 1
        const targetMessage = updatedMessages[targetIndex]
        
        if (targetMessage && targetMessage.role === 'assistant') {
          // 初始化sources数组（如果不存在）
          if (!targetMessage.sources) {
            targetMessage.sources = []
          }
          
          // 从新格式中提取文件名和路径
          const contentObj = data.content as { fileName: string; filePath: string }
          if (typeof data.content === 'object' && contentObj.fileName && contentObj.filePath) {
            const { fileName, filePath } = contentObj
            
            // 检查是否已经存在相同文件名的source
            const existingIndex = targetMessage.sources.findIndex(s => s.name === fileName)
            
            // 如果不存在，则添加新的source
            if (existingIndex === -1) {
              targetMessage.sources.push({
                name: fileName,
                url: filePath
              })
            } else {
              // 如果已存在，则更新路径
              targetMessage.sources[existingIndex].url = filePath
            }
          }
        }
        return updatedMessages
      })
    }
  } catch (e) {
    console.error('Error parsing event stream:', e)
  }

  return { completedContent, reasoningContent }
}

/**
 * 处理流式响应的辅助函数
 * @param reader 响应流读取器
 * @param options 处理选项
 * @returns 处理完成的Promise
 */
export async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: ProcessStreamOptions
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  let completedContent = ''
  let reasoningContent = ''
  let done = false

  while (!done) {
    const { value, done: doneReading } = await reader.read()
    done = doneReading

    if (value) {
      buffer += decoder.decode(value, { stream: true })

      // 处理所有完整的数据行
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || '' // 保留最后一个可能不完整的行

      for (const line of lines) {
        const result = processStreamLine(line, options, {
          completedContent,
          reasoningContent
        })
        completedContent = result.completedContent
        reasoningContent = result.reasoningContent
      }
    }
  }

  // 流处理完成后，对完整内容再次进行处理
  if (completedContent) {
    options.setMessages(currentMessages => {
      const updatedMessages = [...currentMessages]
      const targetIndex = options.messageIndex ?? updatedMessages.length - 1
      const targetMessage = updatedMessages[targetIndex]
      
      if (targetMessage && targetMessage.role === 'assistant') {
        targetMessage.content = completedContent
      }
      return updatedMessages
    })
  }
}

/**
 * 创建一个空的助手消息
 * @returns 空的助手消息对象
 */
export function createEmptyAssistantMessage(): Message {
  return {
    role: 'assistant',
    content: '',
    reasoning: '',
    sources: []
  }
}