import { create } from 'zustand';
import supabaseService from '../services/supabaseService';
import AIService from '../services/aiService';

const useDashboardStore = create((set) => ({
  widgets: [],
  aiModels: [],
  analytics: [],
  isLoading: false,
  error: null,
  widgetError: null,
  aiModelsError: null,
  analyticsError: null,

  // Fetch dashboard widgets
  fetchWidgets: async (userId) => {
    if (!userId) return;
    
    set({ isLoading: true, widgetError: null });
    try {
      const widgets = await supabaseService.getWidgets(userId);
      set({ widgets, isLoading: false });
    } catch (error) {
      console.error('Error fetching widgets:', error);
      set({ widgetError: error.message, isLoading: false });
    }
  },

  // Add a new widget
  addWidget: async (widget) => {
    set({ isLoading: true, error: null });
    try {
      const newWidget = await supabaseService.createWidget(widget);
      set((state) => ({ 
        widgets: [...state.widgets, newWidget],
        isLoading: false 
      }));
    } catch (error) {
      console.error('Error adding widget:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Update a widget
  updateWidget: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedWidget = await supabaseService.updateWidget(id, updates);
      set((state) => ({
        widgets: state.widgets.map(widget =>
          widget.id === id ? updatedWidget : widget
        ),
        isLoading: false
      }));
    } catch (error) {
      console.error('Error updating widget:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Delete a widget
  deleteWidget: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await supabaseService.deleteWidget(id);
      set((state) => ({
        widgets: state.widgets.filter(widget => widget.id !== id),
        isLoading: false
      }));
    } catch (error) {
      console.error('Error deleting widget:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch AI models - Updated to use AI service
  fetchAiModels: async (userId) => {
    if (!userId) return;
    
    try {
      // First, try to get from Supabase
      let aiModels = [];
      try {
        aiModels = await supabaseService.getAiModels(userId);
      } catch (supabaseError) {
        console.warn('Error fetching AI models from Supabase:', supabaseError);
        // Fall back to the AI service's available models
        aiModels = AIService.getAvailableModels();
      }
      
      set({ aiModels });
    } catch (error) {
      console.error('Error in fetchAiModels:', error);
      // Use available models from AI service as fallback
      const fallbackModels = AIService.getAvailableModels();
      set({ 
        aiModels: fallbackModels,
        aiModelsError: error.message 
      });
    }
  },

  // Add a new AI model
  addAiModel: async (model) => {
    set({ isLoading: true, error: null });
    try {
      const newModel = await supabaseService.createAiModel(model);
      set((state) => ({ 
        aiModels: [...state.aiModels, newModel],
        isLoading: false 
      }));
    } catch (error) {
      console.error('Error adding AI model:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Update an AI model
  updateAiModel: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedModel = await supabaseService.updateAiModel(id, updates);
      set((state) => ({
        aiModels: state.aiModels.map(model =>
          model.id === id ? updatedModel : model
        ),
        isLoading: false
      }));
    } catch (error) {
      console.error('Error updating AI model:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Delete an AI model
  deleteAiModel: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await supabaseService.deleteAiModel(id);
      set((state) => ({
        aiModels: state.aiModels.filter(model => model.id !== id),
        isLoading: false
      }));
    } catch (error) {
      console.error('Error deleting AI model:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Generate response from AI model
  generateAIResponse: async (prompt, modelId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await AIService.generateResponse(prompt, modelId);
      set({ isLoading: false });
      return response;
    } catch (error) {
      console.error('Error generating AI response:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Get available AI models from service
  getAvailableAIModels: () => {
    return AIService.getAvailableModels();
  },

  // Fetch analytics data
  fetchAnalytics: async (userId, startDate, endDate) => {
    if (!userId) return;
    
    try {
      const analytics = await supabaseService.getAnalytics(userId, startDate, endDate);
      set({ analytics });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      set({ analyticsError: error.message });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Reset store
  reset: () => set({ 
    widgets: [], 
    aiModels: [], 
    analytics: [], 
    isLoading: false, 
    error: null,
    widgetError: null,
    aiModelsError: null,
    analyticsError: null,
  })
}));

export default useDashboardStore;