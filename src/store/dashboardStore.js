import { create } from 'zustand';
import supabaseService from '../services/supabaseService';
import AIService from '../services/aiService';

const useDashboardStore = create((set, get) => ({
  widgets: [],
  aiModels: [],
  analytics: [],
  isLoading: false,
  error: null,
  widgetError: null,
  aiModelsError: null,
  analyticsError: null,

  metrics: {
    totalApiRequests: 0,
    totalTokensProcessed: 0,
    totalCost: 0,
    activeModels: 0,
    apiRequestChange: 0,
    tokensChange: 0,
    costChange: 0,
    modelChange: 0,
  },

  computeMetrics: () => {
    const { widgets, aiModels } = get()
    const totalApiRequests = aiModels.reduce((sum, model) => sum + (model.api_requests || 0), 0)
    const totalTokensProcessed = aiModels.reduce((sum, model) => sum + (model.tokens_processed || 0), 0)
    const totalCost = aiModels.reduce((sum, model) => sum + (model.cost || 0), 0)
    const activeModels = aiModels.filter(m => m.status === 'active').length

    set({
      metrics: {
        totalApiRequests,
        totalTokensProcessed,
        totalCost,
        activeModels,
        apiRequestChange: 0,
        tokensChange: 0,
        costChange: 0,
        modelChange: 0,
      }
    })
  },

  transformAnalyticsToActivityChart: (analytics) => {
    if (!analytics || analytics.length === 0) return []
    const requestRecords = analytics.filter(a => a.metric === 'api_requests' || a.metric === 'request')
    if (requestRecords.length === 0) return []
    const buckets = {}
    requestRecords.forEach(record => {
      const date = new Date(record.created_at)
      const hour = date.getHours().toString().padStart(2, '0') + ':00'
      buckets[hour] = (buckets[hour] || 0) + (Number(record.value) || 0)
    })
    return Object.entries(buckets)
      .map(([time, requests]) => ({ time, requests }))
      .sort((a, b) => a.time.localeCompare(b.time))
  },

  transformAnalyticsToRecentActivity: (analytics, aiModels = []) => {
    const activities = []
    const modelMap = {}
    aiModels.forEach(m => { modelMap[m.id] = m })
    analytics.forEach((record, index) => {
      const model = modelMap[record.user_id] || { name: 'Unknown Model', provider: 'Unknown' }
      activities.push({
        id: record.id || index,
        model: model.name,
        prompt: record.metric || 'AI Request',
        status: 'completed',
        tokens: Math.round(Number(record.value) || 0),
        time: record.created_at ? new Date(record.created_at).toLocaleString() : 'recently',
      })
    })
    return activities.slice(0, 5)
  },

  transformModelsToUsageChart: (aiModels) => {
    if (!aiModels || aiModels.length === 0) return []
    const total = aiModels.reduce((sum, m) => sum + (m.api_requests || 0), 0)
    if (total === 0) return aiModels.map(m => ({ name: m.name, value: Math.round((m.cost || 0) * 100), color: '' }))
    return aiModels.map(m => ({
      name: m.name,
      value: Math.round(((m.api_requests || 0) / total) * 100) || Math.round((m.cost || 0) * 10),
    }))
  },

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
      await supabaseService.createWidget(widget);
      set((state) => ({ 
        widgets: [...state.widgets, widget],
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
      await supabaseService.updateWidget(id, updates);
      set((state) => ({
        widgets: state.widgets.map(widget =>
          widget.id === id ? { ...widget, ...updates } : widget
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
      let aiModels = [];
      try {
        aiModels = await supabaseService.getAiModels(userId);
      } catch (supabaseError) {
        console.warn('Error fetching AI models from Supabase:', supabaseError);
      }
      
      if (!aiModels || aiModels.length === 0) {
        aiModels = AIService.getAvailableModels();
      }
      
      set({ aiModels });
      get().computeMetrics()
    } catch (error) {
      console.error('Error in fetchAiModels:', error);
      const fallbackModels = AIService.getAvailableModels();
      set({ 
        aiModels: fallbackModels,
        aiModelsError: error.message 
      });
      get().computeMetrics()
    }
  },

  // Add a new AI model
  addAiModel: async (model) => {
    set({ isLoading: true, error: null });
    try {
      await supabaseService.createAiModel(model);
      set((state) => ({ 
        aiModels: [...state.aiModels, model],
        isLoading: false 
      }));
      get().computeMetrics()
    } catch (error) {
      console.error('Error adding AI model:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Update an AI model
  updateAiModel: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      await supabaseService.updateAiModel(id, updates);
      set((state) => ({
        aiModels: state.aiModels.map(model =>
          model.id === id ? { ...model, ...updates } : model
        ),
        isLoading: false
      }));
      get().computeMetrics()
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
      get().computeMetrics()
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

  fetchDashboardData: async (userId) => {
    if (!userId) return
    const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace('/api', '') || 'http://localhost:8787'
    try {
      const response = await fetch(`${backendUrl}/api/dashboard?userId=${encodeURIComponent(userId)}`)
      if (!response.ok) throw new Error(`Backend responded with ${response.status}`)
      const data = await response.json()
      if (data.metrics) {
        set({
          aiModels: data.aiModels || [],
          analytics: data.analytics || [],
          metrics: data.metrics,
        })
      }
    } catch (error) {
      console.warn('Backend dashboard fetch failed, falling back to Supabase:', error.message)
      get().fetchWidgets(userId)
      get().fetchAiModels(userId)
      get().fetchAnalytics(userId)
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
    metrics: {
      totalApiRequests: 0,
      totalTokensProcessed: 0,
      totalCost: 0,
      activeModels: 0,
      apiRequestChange: 0,
      tokensChange: 0,
      costChange: 0,
      modelChange: 0,
    },
  })
}));

export default useDashboardStore;