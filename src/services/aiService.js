class AIService {
  async generateResponse(prompt, modelId = 'gpt-4o') {
    try {
      if (import.meta.env.VITE_OPENAI_API_KEY && 
          (modelId.startsWith('gpt') || ['gpt-4o', 'gpt-3.5'].includes(modelId))) {
        return await this.callOpenAI(prompt, modelId);
      }
      
      if (import.meta.env.VITE_ANTHROPIC_API_KEY && 
          (modelId.startsWith('claude') || modelId.includes('claude'))) {
        return await this.callAnthropic(prompt, modelId);
      }
      
      if (import.meta.env.VITE_HUGGING_FACE_API_KEY && modelId.includes('/')) {
        return await this.callHuggingFace(prompt, modelId);
      }
      
      return this.simulateAIResponse(prompt, modelId);
    } catch (error) {
      console.error('AI Service Error:', error);
      return this.simulateAIResponse(prompt, modelId);
    }
  }

  async callOpenAI(prompt, modelId) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.warn('OpenAI call failed, falling back to simulation:', error.message);
      return this.simulateAIResponse(prompt, modelId);
    }
  }

  async callAnthropic(prompt, modelId) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.warn('Anthropic call failed, falling back to simulation:', error.message);
      return this.simulateAIResponse(prompt, modelId);
    }
  }

  async callHuggingFace(prompt, modelId) {
    try {
      const huggingFaceModel = modelId.includes('/') ? modelId : 'microsoft/DialoGPT-medium';
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${huggingFaceModel}`,
        {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_HUGGING_FACE_API_KEY}` },
          method: 'POST',
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 200,
              return_full_text: false
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) && data[0]?.generated_text 
        ? data[0].generated_text 
        : data.generated_text || 'No response generated';
    } catch (error) {
      console.warn('HuggingFace call failed, falling back to simulation:', error.message);
      return this.simulateAIResponse(prompt, modelId);
    }
  }

  simulateAIResponse(prompt, modelId) {
    // Simulated response for development/testing purposes
    const responses = {
      'gpt-4o': `This is a simulated response from GPT-4o for your prompt: "${prompt}". In a real implementation, this would connect to the OpenAI API.`,
      'claude-3.5': `This is a simulated response from Claude 3.5 for your prompt: "${prompt}". In a real implementation, this would connect to the Anthropic API.`,
      'gemini-pro': `This is a simulated response from Gemini Pro for your prompt: "${prompt}". In a real implementation, this would connect to the Google AI API.`,
      'llama-3': `This is a simulated response from Llama 3 for your prompt: "${prompt}". In a real implementation, this would connect to the Meta AI API.`
    };

    return responses[modelId] || `Simulated response for: ${prompt}`;
  }

  // Method to get available models
  getAvailableModels() {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', status: 'active', cost: 0.12, latency: 450, api_requests: 0, tokens_processed: 0 },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'active', cost: 0.15, latency: 520, api_requests: 0, tokens_processed: 0 },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', status: 'active', cost: 0.10, latency: 380, api_requests: 0, tokens_processed: 0 },
      { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', status: 'inactive', cost: 0.05, latency: 600, api_requests: 0, tokens_processed: 0 },
      { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral AI', status: 'active', cost: 0.11, latency: 410, api_requests: 0, tokens_processed: 0 },
    ];
  }
}

export default new AIService();