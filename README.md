# Zac-AI Dashboard

Zac-AI Dashboard is a modern, collaborative React application designed for AI-powered dashboard functionality with real-time collaboration features. The project focuses on AI agent interactions, real-time collaboration, and customizable data dashboards, enabling teams to visualize and analyze AI-generated insights together.

## About

Zac-AI Dashboard is a cutting-edge platform that combines AI-powered data visualization with real-time collaborative features. It enables teams to work together on interactive dashboards, generate charts and visualizations through natural language prompts, and collaborate in real-time with cursor tracking and shared canvases.

The platform is designed for AI engineers, data analysts, product teams, and developers who need a unified interface for managing multiple AI models and collaborating on AI-generated insights and visualizations.

## Tech Stack

### Frontend
- **Framework**: React 19.2.7
- **Build Tool**: Vite 8.1.1
- **Styling**: Tailwind CSS 4.3.2 with custom design tokens and dark mode support
- **Icons**: Lucide React 1.24.0
- **Charts**: Recharts 3.9.2 for dynamic data visualization
- **State Management**: React built-in hooks (useState, useEffect, etc.) + Zustand 4.5.7
- **Routing**: React Router DOM 6.26.2
- **UI Components**: Tailwind CSS with custom CSS variables for theming

### Backend & Services
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Real-time Collaboration**: Custom WebSocket implementation + Supabase Realtime
- **AI Integration**: Direct API calls to multiple providers with backend proxy
- **HTTP Client**: Axios 1.18.1

### Development Tools
- **Code Quality**: ESLint 10.6.0 with React Hooks plugin
- **Package Manager**: npm or pnpm
- **Build System**: Vite (with potential migration to Rolldown)

## AI Models

The platform integrates with multiple AI providers and models to offer diverse capabilities:

### Supported AI Providers
- **Google Gemini**: Gemini 2.0 Flash (default), Gemini Pro, Gemini 1.5 Flash
- **OpenRouter**: Google Gemma 4 26B A4B, OpenAI GPT-OSS 20B, Cohere North Mini Code, Poolside Laguna S 2.1
- **Hugging Face**: Free image generation models
- **Meta**: Llama 3 70B (via OpenRouter)
- **Mistral**: Mistral Large (via OpenRouter)

### Model Capabilities
- **Text Generation**: General conversation, code generation, and reasoning
- **Data Visualization**: Natural language to chart conversion (bar, line, pie charts)
- **Image Generation**: Text-to-image capabilities
- **Structured Output**: JSON responses for data visualization

### Model Selection
The platform intelligently routes requests to appropriate models based on the query type:
- Charts and data visualization: Preferably Gemini 2.0 Flash
- Code generation: Cohere North Mini Code or Llama 3
- Image generation: Hugging Face image models
- General queries: Gemma 4 26B A4B

## Features

### AI-Powered Dashboard
- **Natural Language to Visualization**: Convert text prompts into interactive charts and graphs
- **Real-time Chart Generation**: Generate bar charts, line charts, pie charts, and tables from natural language
- **Streaming Responses**: AI responses rendered in real-time with chunked rendering
- **Smart Parsing**: Automatically detects intent for charts, tables, and images from user prompts

### Real-time Collaboration
- **Shared Canvas**: Multiple users can place and manipulate widgets simultaneously
- **Live Cursor Tracking**: See other users' cursors with unique colors and names
- **User Presence**: Real-time indicators showing who is currently online
- **Drag-and-Drop Widgets**: Collaboratively arrange and reposition dashboard elements
- **WebSocket Synchronization**: Real-time state sync across all connected clients
- **Session Management**: Create and join collaboration sessions with invite codes

### Dashboard Functionality
- **Interactive Widgets**: Draggable and resizable chart containers
- **Multiple Chart Types**: Bar, line, pie charts, tables, and image widgets
- **Responsive Layout**: Adapts to different screen sizes and devices
- **Customizable Metrics**: Display various KPIs and analytics data
- **Widget Persistence**: Save and restore dashboard layouts

### Authentication & Security
- **Supabase Integration**: Secure email/password and social authentication
- **User Profiles**: Personalized experience with user-specific data
- **Session Management**: Secure session handling and cleanup
- **Environment Variable Security**: Proper handling of API keys and secrets

### UI/UX Features
- **Dark/Light Theme**: Automatic theme switching with manual override capability
- **Responsive Design**: Mobile, tablet, and desktop optimized layouts
- **Intuitive Navigation**: Sidebar navigation with collapsible sections
- **Accessibility**: Proper contrast ratios and keyboard navigation support
- **Loading States**: Smooth loading animations and skeleton screens
- **Error Handling**: Graceful degradation with helpful error messages

### Advanced Capabilities
- **Model Comparison**: Side-by-side comparison of different AI model outputs
- **Cost Tracking**: Monitor API usage and costs across different models
- **Analytics Dashboard**: Visualize usage patterns and model performance
- **Export Options**: Save and share dashboard configurations
- **Custom Prompts**: Save and reuse frequently used AI prompts

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd Zac-AI-Dashboard
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables by creating `.env.local`:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://tjtxbbykgyqkeuzndtoi.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NvIkrwZQObxSuvJBifDyZA_uQysjEo9

# Backend Configuration
VITE_BACKEND_URL=http://localhost:8787

# AI Provider Keys (Optional - for full AI functionality)
OPENROUTER_API_KEY=your_openrouter_key
GOOGLE_AI_API_KEY=your_google_ai_key
ANTHROPIC_API_KEY=your_anthropic_key
HUGGING_FACE_API_KEY=your_hf_key
```

4. Start the development servers:
```bash
# Terminal 1: Start the AI backend
npm run server

# Terminal 2: Start the frontend
npm run dev
```

The application will be available at http://localhost:5173

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_BACKEND_URL` | AI proxy backend URL | Recommended |
| `OPENROUTER_API_KEY` | OpenRouter API key | Optional (for OpenRouter models) |
| `GOOGLE_AI_API_KEY` | Google AI API key | Optional (for Gemini models) |
| `ANTHROPIC_API_KEY` | Anthropic API key | Optional (for Claude models) |
| `HUGGING_FACE_API_KEY` | Hugging Face API key | Optional (for HF models) |

## Scripts

- `npm run dev`: Start development server
- `npm run server`: Start AI proxy backend
- `npm run dev:all`: Start both frontend and backend
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint
- `npm run serve`: Serve production build

## Contributing

We welcome contributions to Zac-AI Dashboard! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

If you encounter any issues or have questions about the project, please open an issue in the repository.