import { create } from 'zustand';
import AIService from '../services/aiService';

export const useAIStore = create((set, get) => ({
  // Available AI models
  aiModels: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', status: 'active', latency: 120, cost: 0.01 },
    { id: 'claude-3.5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'active', latency: 150, cost: 0.02 },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', status: 'active', latency: 100, cost: 0.015 },
    { id: 'llama-3', name: 'Llama 3 70B', provider: 'Meta', status: 'active', latency: 200, cost: 0.005 },
    { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral AI', status: 'active', latency: 180, cost: 0.012 },
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
      
      set({ 
        conversations: updatedConversations,
        isLoading: false 
      });
      
      return response;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Clear a specific conversation
  clearConversation: (modelId) => {
    const { conversations } = get();
    const updatedConversations = { ...conversations };
    delete updatedConversations[modelId];
    set({ conversations: updatedConversations });
  },
  
  // Clear all conversations
  clearAllConversations: () => {
    set({ conversations: {} });
  },
  
  // Add a custom AI model
  addCustomModel: (modelData) => {
    const { aiModels } = get();
    const newModel = {
      id: modelData.id || `custom-${Date.now()}`,
      name: modelData.name,
      provider: modelData.provider || 'Custom',
      status: 'active',
      latency: modelData.latency || 0,
      cost: modelData.cost || 0,
      ...modelData
    };
    
    set({ aiModels: [...aiModels, newModel] });
  },
  
  // Delete an AI model
  deleteModel: (modelId) => {
    const { aiModels } = get();
    set({ aiModels: aiModels.filter(model => model.id !== modelId) });
  },
  
  // Update model status
  updateModelStatus: (modelId, status) => {
    const { aiModels } = get();
    const updatedModels = aiModels.map(model => 
      model.id === modelId ? { ...model, status } : model
    );
    set({ aiModels: updatedModels });
  },
  
  // Clear any errors
  clearError: () => {
    set({ error: null });
  }
}));