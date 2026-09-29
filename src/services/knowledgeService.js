/**
 * Frontend service for the Knowledge Base (RAG) endpoints.
 *
 * All calls go through the backend proxy (/api/knowledge/*) so the browser
 * never touches Supabase directly for knowledge data — row-level security
 * is enforced server-side.
 */
class KnowledgeService {
  constructor() {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
    this.baseUrl = backendUrl ? `${backendUrl}/knowledge` : '/api/knowledge'
  }

  // GET /api/knowledge?sessionId=xxx
  async listDocuments(sessionId) {
    const response = await fetch(`${this.baseUrl}?sessionId=${encodeURIComponent(sessionId)}`)
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const data = await response.json()
    return data.documents || []
  }

  // POST /api/knowledge
  async createDocument(sessionId, userId, title, content) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId, title, content }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const data = await response.json()
    return data.document
  }

  // POST /api/knowledge/search
  async searchDocuments(sessionId, query, topK = 5) {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, query, topK }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const data = await response.json()
    return data.results || []
  }

  // DELETE /api/knowledge/:id?userId=xxx
  async deleteDocument(id, userId = null) {
    const params = new URLSearchParams()
    if (userId) params.set('userId', userId)
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}?${params.toString()}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    return response.json()
  }
}

export default new KnowledgeService()
