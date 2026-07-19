class AIService {
  async generateResponse(prompt, modelId = 'gpt-4o') {
    try {
      // First, check if we have API keys configured
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        // Fallback to local simulation if no API key is available
        return this.simulateAIResponse(prompt, modelId);
      }

      // Determine which provider to use based on available keys
      if (import.meta.env.VITE_OPENAI_API_KEY) {
        return await this.callOpenAI(prompt, modelId);
      } else if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
        return await this.callAnthropic(prompt, modelId);
      } else {
        return this.simulateAIResponse(prompt, modelId);
      }
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error(`AI service error: ${error.message}`, { cause: error });
    }
  }

  async callOpenAI(prompt, modelId) {
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
  }

  async callAnthropic(prompt, modelId) {
    // Anthropic API call
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
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
      { id: 'claude-3.5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
      { id: 'llama-3', name: 'Llama 3 70B', provider: 'Meta' }
    ];
  }
}

export default new AIService();