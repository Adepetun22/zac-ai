# Zac-AI Dashboard

Zac-AI Dashboard is a modern React application designed for AI-powered dashboard functionality with real-time collaboration features. The project focuses on AI agent interactions, real-time collaboration, and customizable data dashboards.

## Features

- **AI Agent Interaction**: Supports chat interface, natural language prompt parsing, and streaming response rendering
- **Real-time Collaboration**: WebSocket-based state synchronization with cursor tracking, user presence indicators, and collaborative widgets
- **Dynamic Dashboard**: Responsive grid layout, on-demand widget loading, and chart visualizations
- **Authentication**: Login and signup flows with social authentication options
- **Multiple Pages**: Dashboard, AI models management, analytics, collaboration workspace, and settings
- **Responsive Design**: Works across mobile, tablet, and desktop devices
- **Dark/Light Mode**: Automatic theme switching with CSS variables

## Tech Stack

- **Framework**: React 19.2.7
- **Build Tool**: Vite 8.1.1
- **Styling**: Tailwind CSS 4.3.2 with custom design tokens
- **Icons**: Lucide React
- **Charts**: Recharts
- **State Management**: Built-in React hooks (useState, useEffect, etc.)
- **WebSockets**: Custom hook for real-time collaboration
- **Development**: ESLint for code quality

## Project Structure

```
Zac-AI-DASHBOARD/
├── src/
│   ├── assets/
│   ├── components/       # Shared UI components (MetricCard, Charts, etc.)
│   ├── data/             # Data files and search indexes
│   ├── features/         # Domain-driven feature folders
│   │   ├── ai-models/    # AI models management page
│   │   ├── analytics/    # Analytics page
│   │   ├── auth/         # Authentication pages (Login, Signup)
│   │   ├── collaboration/ # Real-time collaboration features
│   │   ├── dashboard/    # Main dashboard components
│   │   └── settings/     # Settings page
│   ├── hooks/            # Custom React hooks (useWebSocket)
│   ├── styles/           # Global styles and Tailwind setup
│   ├── App.jsx           # Main application router
│   └── main.jsx          # Application entry point
├── public/               # Static assets
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite build configuration
└── README.md
```

## Installation

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

3. Start the development server:
```bash
npm run dev
# or
pnpm dev
```

The application will be available at http://localhost:5173

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues

## Key Components

### Dashboard Page
The main dashboard displays key metrics in cards and various charts:
- Total API Requests
- Tokens Processed
- Total Cost
- Active Models
- Activity and usage charts
- Recent activity feed

### AI Models Page
Manages AI model configurations with:
- Model listing with status indicators
- Provider information
- Request counts and latency metrics
- Cost per 1K tokens
- Action buttons for running, editing, and deleting models

### Collaboration Page
Features real-time collaboration capabilities:
- Interactive canvas for placing data widgets
- AI prompt interface to generate charts and tables
- Live cursor tracking for other users
- Drag-and-drop widget positioning
- WebSocket-based synchronization

### Authentication
Secure login and signup pages with:
- Social authentication options (Google, GitHub)
- Email/password authentication
- Password visibility toggle
- Forgot password functionality

## Architecture Highlights

### State Management
The application uses React's built-in state management rather than external libraries like Redux or Zustand. Components manage their own state with useState and share data through props.

### Real-time Collaboration
The collaboration feature implements a custom WebSocket hook ([useWebSocket](file:///c:/Users/Orcave/Desktop/Zac-AI-Dashboard/src/hooks/useWebSocket.js#L4-L56)) that simulates real-time functionality during development. In production, this would connect to a real WebSocket server.

### Dynamic Content Generation
The AI features parse natural language prompts to generate different types of content including:
- Bar charts for revenue summaries
- Line charts for trend analysis
- Pie charts for distribution breakdowns
- Tables for structured data

### Performance Considerations
- Component-based architecture for optimal re-rendering
- Efficient state updates to minimize unnecessary renders
- Virtualized lists for large datasets
- Lazy loading for non-critical components

## Styling System

The application uses Tailwind CSS with a custom theme configured in [src/styles/index.css](file:///c:/Users/Orcave/Desktop/Zac-AI-Dashboard/src/styles/index.css). The styling system includes:

- CSS variables for consistent theming across light and dark modes
- Responsive breakpoints for different screen sizes
- Consistent color palette with brand colors
- Accessible contrast ratios

## Theming

The application supports both light and dark themes controlled by CSS variables. The theme automatically adapts based on system preferences, but can also be manually switched.

Light theme variables:
- Brand colors: #EEF2FF (50), #6366F1 (500), #4338CA (700)
- Backgrounds: #F9FAFB (canvas), #FFFFFF (surface/overlay)
- Text: #111827 (primary), #4B5563 (secondary), #9CA3AF (muted)
- Borders: #E5E7EB (subtle), #9CA3AF (strong)

Dark theme variables:
- Brand colors: #312E81 (50), #818CF8 (500), #C7D2FE (700)
- Backgrounds: #0B0F19 (canvas), #161F30 (surface), #1F2A3F (overlay)
- Text: #F9FAFB (primary), #9CA3AF (secondary), #6B7280 (muted)
- Borders: #24324D (subtle), #4B5563 (strong)

## Navigation

The application features a responsive sidebar navigation with the following options:
- Dashboard
- AI Models
- Collaboration
- Analytics
- Settings

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions about the project, please open an issue in the repository.