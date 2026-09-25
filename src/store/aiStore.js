import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Built-in free models always available in Collaboration
export const FREE_MODELS = [
  { id: 'openrouter/google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0, api_requests: 0, tokens_processed: 0, isBuiltIn: true },
  { id: 'openrouter/cohere/north-mini-code:free', name: 'North Mini Code (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0, api_requests: 0, tokens_processed: 0, isBuiltIn: true },
  { id: 'openrouter/poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0, api_requests: 0, tokens_processed: 0, isBuiltIn: true },
  { id: 'openrouter/meta-llama/llama-3.1-70b-instruct:free', name: 'Llama 3.1 70B (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0, api_requests: 0, tokens_processed: 0, isBuiltIn: true },
  { id: 'huggingface/free-image', name: 'Free Image Gen (HF)', provider: 'HuggingFace', status: 'active', latency: 3000, cost: 0, api_requests: 0, tokens_processed: 0, isBuiltIn: true, isImage: true },
];

export const useAIStore = create(
  persist(
    (set, _get) => ({
  // All models: built-in free + user-registered. Single source of truth for Collaboration.
  aiModels: [...FREE_MODELS],

  // conversations keyed by modelId
  conversations: {},

  // Sync user-registered models from dashboardStore into aiModels.
  // Keeps built-in free models intact; merges/replaces user models by model_id.
  syncUserModels: (userModels) => {
    const active = (userModels || []).filter(m => m.status === 'active' && m.model_id);
    set(state => {
      const builtIns = state.aiModels.filter(m => m.isBuiltIn);
      const merged = [...builtIns];
      active.forEach(m => {
        if (!merged.find(b => b.id === m.model_id)) {
          merged.push({
            id: m.model_id,
            name: `${m.name} ★`,
            provider: m.provider,
            status: 'active',
            latency: m.latency || 0,
            cost: m.cost || 0,
            api_key: m.api_key || null,
            api_requests: m.api_requests || 0,
            tokens_processed: m.tokens_processed || 0,
            isBuiltIn: false,
          });
        }
      });
      return { aiModels: merged };
    });
  },

  // Remove a user model by its model_id (called when deleted from AI Models page)
  removeUserModel: (modelId) => {
    set(state => ({
      aiModels: state.aiModels.filter(m => m.isBuiltIn || m.id !== modelId),
    }));
  },

  // Record a completed AI request: increment api_requests, add tokens estimate
  recordRequest: (modelId, responseText = '') => {
    const tokens = Math.ceil((responseText.length || 0) / 4);
    set(state => ({
      aiModels: state.aiModels.map(m =>
        m.id === modelId
          ? { ...m, api_requests: (m.api_requests || 0) + 1, tokens_processed: (m.tokens_processed || 0) + tokens }
          : m
      ),
      conversations: state.conversations,
    }));
  },

  // Append a user+assistant message pair to conversations
  recordConversation: (modelId, userText, assistantText) => {
    set(state => ({
      conversations: {
        ...state.conversations,
        [modelId]: [
          ...(state.conversations[modelId] || []),
          { role: 'user', content: userText },
          { role: 'assistant', content: assistantText },
        ],
      },
    }));
  },
}),
  {
    name: 'zac-ai-store',
    partialize: (state) => ({
      aiModels: state.aiModels,
      conversations: state.conversations,
    }),
    onRehydrateStorage: () => (state) => {
      if (!state) return;
      const builtInMap = Object.fromEntries(FREE_MODELS.map(m => [m.id, m]));
      // Refresh built-in model base fields but keep accumulated stats
      state.aiModels = state.aiModels.map(m =>
        builtInMap[m.id]
          ? { ...builtInMap[m.id], api_requests: m.api_requests, tokens_processed: m.tokens_processed }
          : m
      );
      // Re-add any built-in models missing from persisted state
      FREE_MODELS.forEach(fm => {
        if (!state.aiModels.find(m => m.id === fm.id)) state.aiModels.push({ ...fm });
      });
    },
  }
  )
);