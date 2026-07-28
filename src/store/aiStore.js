import { create } from 'zustand';
import AIService from '../services/aiService';

export const useAIStore = create((set, get) => ({
  // Available AI models
  aiModels: [
    { id: 'openrouter/google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0 },
    { id: 'openrouter/openai/gpt-oss-20b:free', name: 'GPT-OSS 20B (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0 },
    { id: 'openrouter/cohere/north-mini-code:free', name: 'North Mini Code (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0 },
    { id: 'openrouter/meta-llama/llama-3.1-70b-instruct:free', name: 'Llama 3.1 70B (Free)', provider: 'OpenRouter', status: 'active', latency: 600, cost: 0 },
  ],
  
  // Loading states
  isLoading: false,
  error: null,
  
  // Current conversation state
  conversations: {},
  
  // Fetch available AI models
  fetchAiModels: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get models from the AI service
      const models = AIService.getAvailableModels();
      set({ aiModels: models, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // Generate response from a specific AI model
  generateResponse: async (prompt, modelId) => {
    const { conversations } = get();
    const conversationId = modelId;
    
    set({ isLoading: true, error: null });
    
    try {
      // Get the AI response
      const response = await AIService.generateResponse(prompt, modelId);
      
      // Update the conversation
      const updatedConversations = {
        ...conversations,
        [conversationId]: [
          ...(conversations[conversationId] || []),
          { role: 'user', content: prompt },
          { role: 'assistant', content: response }
        ]
      };
      
      set({ conversations: updatedConversations, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // Add a new conversation
  addConversation: (conversationId, initialMessage) => {
    set(state => ({
      conversations: {
        ...state.conversations,
        [conversationId]: initialMessage ? [initialMessage] : []
      }
    }));
  },
  
  // Clear a conversation
  clearConversation: (conversationId) => {
    set(state => {
      const updatedConversations = { ...state.conversations };
      delete updatedConversations[conversationId];
      return { conversations: updatedConversations };
    });
  },
  
  // Clear all conversations
  clearAllConversations: () => {
    set({ conversations: {} });
  },
  
  // Update model status
  updateModelStatus: (modelId, status) => {
    set(state => ({
      aiModels: state.aiModels.map(model => 
        model.id === modelId ? { ...model, status } : model
      )
    }));
  },
  
  // Update model stats
  updateModelStats: (modelId, stats) => {
    set(state => ({
      aiModels: state.aiModels.map(model => 
        model.id === modelId ? { ...model, ...stats } : model
      )
    }));
  }
}));