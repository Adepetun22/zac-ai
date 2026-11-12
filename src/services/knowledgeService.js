import { authFetch } from './apiClient';

/**
 * Frontend service for the Knowledge Base (RAG) endpoints.
 *
 * All calls go through the authenticated backend proxy (/api/knowledge/*) so
 * the browser never touches Supabase directly for knowledge data — row-level
 * security is enforced server-side.
 */
class KnowledgeService {
  // GET /api/knowledge?sessionId=xxx
  async listDocuments(sessionId) {
    const response = await authFetch(`/knowledge?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.documents || [];
  }

  // POST /api/knowledge
  async createDocument(sessionId, _userId, title, content) {
    const response = await authFetch('/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, title, content }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.document;
  }

  // POST /api/knowledge/search
  async searchDocuments(sessionId, query, topK = 5) {
    const response = await authFetch('/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, query, topK }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.results || [];
  }

  // DELETE /api/knowledge/:id
  async deleteDocument(id) {
    const response = await authFetch(`/knowledge/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return response.json();
  }
}

export default new KnowledgeService();