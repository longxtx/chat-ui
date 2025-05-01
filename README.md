


          
# chat-ui

纯净的对话窗口，支持流式、markdown格式的聊天界面。这是一个基于Next.js构建的现代化聊天应用，提供流畅的用户体验和丰富的功能。

## 项目简介

chat-ui 是一个轻量级的聊天界面，专为提供流畅的对话体验而设计。它具有以下特点：

- 🚀 **流式响应** - 实时显示AI回复，无需等待完整响应
- 📝 **Markdown支持** - 完整支持Markdown格式，包括代码块、表格等
- 🧠 **思考过程可视化** - 可选择显示AI的思考过程
- 🌙 **深色模式** - 支持明暗主题切换
- 🔄 **消息重新生成** - 支持重新生成AI回复
- 🔒 **用户认证** - 内置简单的登录系统

## 技术栈

- **前端框架**: Next.js 15.x (使用App Router)
- **UI组件**: React 19.x, TailwindCSS 4.x
- **Markdown渲染**: React-Markdown
- **API集成**: OpenAI兼容接口，支持OpenRouter
- **流式处理**: 使用Web Streams API处理流式响应

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境运行

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm run start
```

## 环境变量配置

在项目根目录创建`.env.local`文件，配置以下环境变量：

```
# UI配置
NEXT_PUBLIC_SHOW_PROCESS=true  # 是否默认显示思考过程
NEXT_PUBLIC_SHOW_REFERENCES=true  # 是否显示参考来源
NEXT_PUBLIC_WELCOME_TITLE=欢迎使用聊天应用  # 欢迎标题
NEXT_PUBLIC_WELCOME_MESSAGE=开始一个新的对话，发送消息开始聊天吧。  # 欢迎消息
NEXT_PUBLIC_STREAMING_TYPE=chunked  # 流式响应类型：chunked或complete
```

## 项目结构

```
chat-ui/
├── public/           # 静态资源
├── src/
│   ├── app/          # Next.js应用路由
│   │   ├── api/      # API路由
│   │   └── page.tsx  # 主页面
│   ├── components/   # React组件
│   │   ├── chat-messages.tsx  # 消息显示组件
│   │   ├── chat-panel.tsx     # 输入面板组件
│   │   └── chat.tsx           # 主聊天组件
│   └── lib/          # 工具库
│       ├── hooks/    # React钩子
│       ├── services/ # 服务层
│       └── utils/    # 工具函数
```

## 主要功能

### 流式响应处理

系统使用Web Streams API处理来自后端的流式响应，实现打字机效果的实时显示。

### 思考过程显示

可以选择显示或隐藏AI的思考过程，帮助用户理解AI的推理过程。用户可以通过界面上的眼睛图标切换此功能。

### Markdown渲染

支持完整的Markdown语法，包括代码块、表格、列表等，提供良好的格式化内容展示。

### 用户认证

内置简单的登录系统，支持token认证，可以根据需要扩展为更复杂的认证系统。

## API集成

系统默认集成了OpenAI兼容的API接口，可以轻松连接到OpenRouter或其他兼容OpenAI接口的服务。

## 自定义与扩展

### 添加新模型

在API配置中可以轻松添加新的模型选项。

### 自定义UI主题

项目使用TailwindCSS，可以通过修改配置文件自定义UI主题。

### 扩展功能

项目结构清晰，可以轻松扩展新功能，如文件上传、历史记录等。

## 贡献指南

欢迎提交Pull Request或Issue来改进这个项目。

## 许可证

本项目采用MIT许可证。