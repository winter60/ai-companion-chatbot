# AI Emotional Companion Chatbot / AI情感陪伴聊天机器人

A multi-personality AI emotional companion chatbot built with Next.js, featuring Google OAuth authentication and real-time chat capabilities.

一个基于Next.js构建的多人格AI情感陪伴聊天机器人，具有Google OAuth认证和实时聊天功能。

![Demo](https://img.shields.io/badge/status-active-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)

## ✨ Features / 功能特性

### 🤖 Multi-Personality AI Companions / 多种AI陪伴人格
- **Gentle Listener / 温柔倾听者**: Like a caring friend who always understands / 像一个总是理解您的贴心朋友
- **Rational Mentor / 理性导师**: A wise guide who helps you think clearly / 帮助您清晰思考的智慧向导
- **Lively Companion / 活泼伙伴**: An energetic friend who brings joy and laughter / 带来欢乐和笑声的活力朋友

### 🔐 Authentication / 身份认证
- Google OAuth integration with Supabase / Google OAuth集成Supabase认证
- Secure user session management / 安全的用户会话管理
- Avatar and nickname from Google account / 从Google账户获取头像和昵称

### 💬 Chat Features / 聊天功能
- Personality-separated chat history / 按人格分离的聊天记录
- Real-time AI responses / 实时AI回复
- Text-to-Speech (TTS) audio responses / 文字转语音功能
- Rate limiting protection / 请求频率限制保护
- Chat history persistence / 聊天记录持久化

### 🌐 Bilingual Support / 双语支持
- Seamless Chinese/English interface switching / 中英文界面无缝切换
- Localized AI responses / 本地化AI回复
- Cultural context awareness / 文化语境感知

## 🛠️ Tech Stack / 技术栈

- **Frontend / 前端**: Next.js 15, React 19, TypeScript
- **Styling / 样式**: Tailwind CSS, Radix UI
- **Authentication / 认证**: Supabase Auth
- **Database / 数据库**: Supabase PostgreSQL
- **AI API / AI接口**: OpenRouter (Kimi K2 Model)
- **TTS / 语音合成**: ByteDance TTS API
- **Deployment / 部署**: Vercel (recommended / 推荐)

## 🚀 Getting Started / 快速开始

### Prerequisites / 前置要求

- Node.js 18+ 
- pnpm (recommended / 推荐)
- Supabase account / Supabase账户
- OpenRouter API key / OpenRouter API密钥
- ByteDance TTS API key / 字节跳动TTS API密钥

### Installation / 安装

1. **Clone the repository / 克隆仓库**
   ```bash
   git clone https://github.com/winter60/ai-companion-chatbot.git
   cd ai-companion-chatbot
   ```

2. **Install dependencies / 安装依赖**
   ```bash
   pnpm install
   ```

3. **Environment Setup / 环境配置**
   
   Create a `.env.local` file in the root directory / 在根目录创建`.env.local`文件:
   
   ```env
   # Supabase Configuration / Supabase配置
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # AI Chat API Configuration / AI聊天API配置
   OPENROUTER_API_KEY=your_openrouter_api_key
   
   # Text-to-Speech API Configuration / 文字转语音API配置
   TTS_API_KEY=your_tts_api_key
   ```

4. **Supabase Setup / Supabase设置**

   Create the following table in your Supabase database / 在Supabase数据库中创建以下表:
   
   ```sql
   CREATE TABLE chat_messages (
     id TEXT PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     content TEXT NOT NULL,
     sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
     timestamp TIMESTAMPTZ DEFAULT NOW(),
     personality TEXT NOT NULL CHECK (personality IN ('gentle', 'rational', 'lively')),
     audio_data TEXT
   );
   
   -- Enable Row Level Security / 启用行级安全
   ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
   
   -- Create policy for users to access their own messages / 创建用户访问自己消息的策略
   CREATE POLICY "Users can manage their own messages" ON chat_messages
     FOR ALL USING (auth.uid() = user_id);
   ```

5. **Google OAuth Setup / Google OAuth设置**
   
   In your Supabase dashboard / 在Supabase控制台中:
   - Go to Authentication → Settings → Auth Providers
   - Enable Google provider / 启用Google提供商
   - Add your Google OAuth credentials / 添加Google OAuth凭据
   - Set redirect URL to: `https://your-domain.com/auth/callback`

6. **Run the development server / 运行开发服务器**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser / 在浏览器中打开 [http://localhost:3000]

## 📁 Project Structure / 项目结构

```
ai-companion-chatbot/
├── app/                          # Next.js App Router / Next.js应用路由
│   ├── api/                      # API Routes / API路由
│   │   ├── chat/route.ts         # Chat API endpoint / 聊天API端点
│   │   └── tts/route.ts          # TTS API endpoint / 语音API端点
│   ├── globals.css               # Global styles / 全局样式
│   ├── layout.tsx                # Root layout / 根布局
│   └── page.tsx                  # Main chat interface / 主聊天界面
├── components/                   # React components / React组件
│   └── ui/                       # Reusable UI components / 可复用UI组件
├── lib/                          # Utility libraries / 工具库
│   ├── supabaseClient.ts         # Supabase client / Supabase客户端
│   └── utils.ts                  # Helper functions / 辅助函数
├── hooks/                        # Custom React hooks / 自定义React钩子
├── public/                       # Static assets / 静态资源
└── .env.local                    # Environment variables / 环境变量
```

## 🎯 Usage / 使用方法

1. **Sign in with Google / Google登录**
   - Click the Google Sign In button / 点击Google登录按钮
   - Authorize the application / 授权应用程序

2. **Choose AI Personality / 选择AI人格**
   - Select from Gentle Listener, Rational Mentor, or Lively Companion
   - 从温柔倾听者、理性导师或活泼伙伴中选择

3. **Start Chatting / 开始聊天**
   - Type your message and press Enter / 输入消息并按回车
   - Listen to AI responses with the audio button / 点击音频按钮收听AI回复
   - Switch languages anytime / 随时切换语言

4. **Manage Conversations / 管理对话**
   - Each personality maintains separate chat history / 每个人格保持独立的聊天记录
   - Clear conversations or switch personalities as needed / 根据需要清除对话或切换人格

## 🔧 Configuration / 配置

### API Keys / API密钥

- **OpenRouter**: Get your API key from [OpenRouter](https://openrouter.ai) / 从OpenRouter获取API密钥
- **ByteDance TTS**: Register at ByteDance Cloud for TTS services / 在字节跳动云注册TTS服务

### Customization / 自定义

- Modify personality responses in `app/page.tsx` / 在`app/page.tsx`中修改人格回复
- Adjust UI themes in `tailwind.config.js` / 在`tailwind.config.js`中调整UI主题
- Configure rate limiting in API routes / 在API路由中配置频率限制

## 🚀 Deployment / 部署

### Vercel (Recommended / 推荐)

1. Connect your GitHub repository to Vercel / 将GitHub仓库连接到Vercel
2. Add environment variables in Vercel dashboard / 在Vercel控制台添加环境变量
3. Deploy automatically on push / 推送时自动部署

### Other Platforms / 其他平台

The app can be deployed to any platform that supports Next.js applications.
应用可以部署到任何支持Next.js应用的平台。

## 🤝 Contributing / 贡献

Contributions are welcome! Please feel free to submit a Pull Request.
欢迎贡献！请随时提交Pull Request。

1. Fork the repository / Fork仓库
2. Create your feature branch / 创建功能分支
3. Commit your changes / 提交更改
4. Push to the branch / 推送到分支
5. Open a Pull Request / 打开Pull Request

## 📄 License / 许可证

This project is open source and available under the [MIT License](LICENSE).
本项目为开源项目，采用[MIT许可证](LICENSE)。

## 🙏 Acknowledgments / 致谢

- [OpenRouter](https://openrouter.ai) for AI API services / 提供AI API服务
- [Supabase](https://supabase.com) for authentication and database / 提供认证和数据库服务
- [ByteDance](https://www.volcengine.com) for TTS services / 提供TTS语音服务
- [Vercel](https://vercel.com) for hosting platform / 提供托管平台

## 📞 Support / 支持

If you have any questions or need help, please open an issue on GitHub.
如果您有任何问题或需要帮助，请在GitHub上开启issue。

---

**🤖 Generated with Claude Code**

**Co-Authored-By: Claude <noreply@anthropic.com>**