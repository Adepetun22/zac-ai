export const searchIndex = [
  { label: 'Dashboard', description: 'AI platform overview', page: 'dashboard', type: 'Page' },
  { label: 'Analytics', description: 'Performance metrics and charts', page: 'analytics', type: 'Page' },
  { label: 'Collaboration', description: 'Multiplayer canvas with live cursors and AI widgets', page: 'collaboration', type: 'Page' },
  { label: 'Settings', description: 'Account and preferences', page: 'settings', type: 'Page' },
  { label: 'AI Models', description: 'Manage model configurations', page: 'ai-models', type: 'Page' },

  { label: 'GPT-4o', description: 'OpenAI · active · $0.12/1K', page: 'ai-models', type: 'Model' },
  { label: 'Claude 3.5 Sonnet', description: 'Anthropic · active · $0.15/1K', page: 'ai-models', type: 'Model' },
  { label: 'Gemini Pro', description: 'Google · active · $0.10/1K', page: 'ai-models', type: 'Model' },
  { label: 'Llama 3 70B', description: 'Meta · inactive · $0.05/1K', page: 'ai-models', type: 'Model' },
  { label: 'Mistral Large', description: 'Mistral AI · active · $0.11/1K', page: 'ai-models', type: 'Model' },

  { label: 'Analyze customer feedback data', description: 'GPT-4o · completed', page: 'dashboard', type: 'Log' },
  { label: 'Generate product description', description: 'Claude 3.5 · completed', page: 'dashboard', type: 'Log' },
  { label: 'Summarize research paper', description: 'Gemini Pro · processing', page: 'dashboard', type: 'Log' },
  { label: 'Code review and optimization', description: 'Llama 3 · failed', page: 'dashboard', type: 'Log' },
  { label: 'Translate documentation', description: 'GPT-4o · completed', page: 'dashboard', type: 'Log' },

  { label: 'Profile', description: 'Edit name and email', page: 'settings', type: 'Setting' },
  { label: 'Notifications', description: 'Email, push, digest alerts', page: 'settings', type: 'Setting' },
  { label: 'Security', description: 'Change password', page: 'settings', type: 'Setting' },
  { label: 'API Keys', description: 'Production and development keys', page: 'settings', type: 'Setting' },
  { label: 'Appearance', description: 'Theme and accent color', page: 'settings', type: 'Setting' },
]
