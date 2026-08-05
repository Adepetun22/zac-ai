import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Play, X, Check } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';
import { useNotification } from '../../components/useNotification';

function ModelRowActions({ model, onRun, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (confirmDelete) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-xs text-slate-500 mr-1">Delete?</span>
        <button
          onClick={() => { onDelete(model.id); setConfirmDelete(false) }}
          className="p-1.5 text-white bg-red-500 hover:bg-red-600 rounded transition-colors cursor-pointer"
          title="Confirm delete"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => onRun(model)}
        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
        title="Run model"
      >
        <Play className="w-4 h-4" />
      </button>
      <button
        onClick={() => onEdit(model)}
        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
        title="Edit model"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
        title="Delete model"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

const PROVIDER_MODEL_IDS = {
  OpenAI: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4', 'openai/gpt-3.5-turbo'],
  Anthropic: ['anthropic/claude-3-5-sonnet-latest', 'anthropic/claude-3-opus-latest', 'anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-haiku-latest'],
  Google: ['google/gemini-2.0-flash', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro'],
  OpenRouter: ['openrouter/google/gemma-4-26b-a4b-it:free', 'openrouter/openai/gpt-oss-20b:free', 'openrouter/meta-llama/llama-3.1-70b-instruct:free', 'openrouter/mistralai/mistral-large'],
  Meta: ['openrouter/meta-llama/llama-3.1-70b-instruct:free', 'openrouter/meta-llama/llama-3.1-8b-instruct:free'],
  'Mistral AI': ['openrouter/mistralai/mistral-large', 'openrouter/mistralai/mistral-7b-instruct:free'],
  HuggingFace: ['huggingface/free-image'],
  Custom: [],
}

const PROVIDER_KEY_LABELS = {
  OpenAI: 'OpenAI API Key (sk-...)',
  Anthropic: 'Anthropic API Key (sk-ant-...)',
  Google: 'Google AI / Gemini API Key',
  OpenRouter: 'OpenRouter API Key (sk-or-...)',
  Meta: 'OpenRouter API Key (routes Meta via OpenRouter)',
  'Mistral AI': 'OpenRouter API Key (routes Mistral via OpenRouter)',
  HuggingFace: 'Hugging Face API Key (hf_...)',
  Custom: 'API Key',
}

function ModelModal({ model, onClose, onSave }) {
  const [form, setForm] = useState({
    name: model?.name || '',
    provider: model?.provider || 'OpenAI',
    model_id: model?.model_id || '',
    api_key: model?.api_key || '',
    endpoint: model?.endpoint || '',
    status: model?.status || 'active',
    cost: model?.cost ?? 0,
    latency: model?.latency ?? 0,
  });
  const [showKey, setShowKey] = useState(false);

  const modelIdOptions = PROVIDER_MODEL_IDS[form.provider] || [];

  const handleProviderChange = (provider) => {
    const options = PROVIDER_MODEL_IDS[provider] || [];
    setForm(f => ({ ...f, provider, model_id: options[0] || '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, id: model?.id });
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] bg-white dark:bg-[var(--color-bg-canvas)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)] shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
            {model ? 'Edit Model' : 'Add New Model'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-[var(--color-text-primary)] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider first — drives model_id options and key label */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className={inputCls}
            >
              {Object.keys(PROVIDER_MODEL_IDS).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Model ID — dropdown of known IDs or free-text for Custom */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">
              Model ID <span className="text-slate-400 font-normal">(used to route API calls)</span>
            </label>
            {modelIdOptions.length > 0 ? (
              <select
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                className={inputCls}
                required
              >
                <option value="">Select a model ID…</option>
                {modelIdOptions.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="e.g. openai/gpt-4o or your-custom-model-id"
                className={inputCls}
                required
              />
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Display Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. My GPT-4o"
              className={inputCls}
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">
              {PROVIDER_KEY_LABELS[form.provider] || 'API Key'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="Paste your API key here"
                className={inputCls + ' pr-16'}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-1"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Stored in your account. Used only for your requests.</p>
          </div>

          {/* Custom endpoint — only shown for Custom provider */}
          {form.provider === 'Custom' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">API Endpoint URL</label>
              <input
                type="url"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://your-api.example.com/v1/chat/completions"
                className={inputCls}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[var(--color-text-secondary)] mb-1">Cost ($/1K tokens)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-lg text-sm font-medium text-slate-700 dark:text-[var(--color-text-primary)] hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 dark:bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:opacity-90 transition-colors cursor-pointer"
            >
              {model ? 'Save Changes' : 'Add Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AIModelsPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const {
    aiModels,
    isLoading,
    error,
    addAiModel,
    updateAiModel,
    deleteAiModel,
    fetchAiModels,
    clearError,
    generateAIResponse
  } = useDashboardStore();
  const { user } = useAuthStore();
  const { addNotification } = useNotification();

  const filtered = aiModels.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.provider.toLowerCase().includes(search.toLowerCase())
  );

  const uniqueFiltered = filtered.filter((model, index, self) =>
    index === self.findIndex(m => m.id === model.id)
  );

  const handleRun = async (model) => {
    try {
      const response = await generateAIResponse("Say hello in a professional manner", model.id);
      addNotification(`Test response from ${model.name}: ${response.substring(0, 80)}...`, 'info');
    } catch (err) {
      addNotification(`Error running ${model.name}: ${err.message}`, 'error');
    }
  };

  const handleAdd = () => {
    setEditingModel(null);
    setModalOpen(true);
  };

  const handleEdit = (model) => {
    setEditingModel(model);
    setModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (formData.id) {
        await updateAiModel(formData.id, formData);
        addNotification('Model updated successfully', 'success');
      } else {
        await addAiModel({ ...formData, user_id: user?.id });
        addNotification('Model added successfully', 'success');
      }
      setModalOpen(false);
      setEditingModel(null);
    } catch (err) {
      addNotification('Error saving model: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAiModel(id);
      addNotification('Model deleted', 'success');
    } catch (error) {
      addNotification('Error deleting model: ' + error.message, 'error');
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAiModels(user.id);
    }
  }, [user?.id, fetchAiModels]);

  if (isLoading && aiModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              <strong>Error:</strong> {error}
              <button
                onClick={clearError}
                className="ml-4 text-sm font-medium text-red-700 underline"
              >
                Dismiss
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {modalOpen && (
        <ModelModal
          model={editingModel}
          onClose={() => { setModalOpen(false); setEditingModel(null); }}
          onSave={handleSave}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">AI Models</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Manage and monitor your AI model configurations.</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:opacity-90 transition-colors cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      <div className="bg-white dark:bg-[var(--color-bg-surface)] rounded-xl border border-slate-200 dark:border-[var(--color-border-subtle)]">
        <div className="p-3 md:p-4 border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          {/* Mobile card view */}
          <div className="min-750:hidden p-3 md:p-4 space-y-3">
            {uniqueFiltered.length > 0 ? uniqueFiltered.map((model) => (
              <div key={model.id} className="p-4 bg-slate-50 dark:bg-[var(--color-bg-canvas)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-[var(--color-brand-50)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-600 dark:text-[var(--color-brand-500)]">AI</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] truncate">{model.name}</p>
                      <p className="text-xs text-slate-500 truncate">{model.provider}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    model.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {model.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 max-360:grid-cols-2 gap-3 text-center">
                  <div className="p-2 bg-white dark:bg-[var(--color-bg-surface)] rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Requests</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.api_requests || 0}</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-[var(--color-bg-surface)] rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.latency != null ? `${model.latency}ms` : '0ms'}</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-[var(--color-bg-surface)] rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cost</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.cost != null ? `$${model.cost.toFixed(2)}` : '$0.00'}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <ModelRowActions model={model} onRun={handleRun} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-sm text-slate-400">
                {search ? `No models match "${search}"` : 'No models available'}
              </div>
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden min-750:block overflow-x-auto">
            <div className="px-3 md:px-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Requests</th>
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Latency</th>
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cost</th>
                    <th className="text-right px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[var(--color-border-subtle)]">
                  {uniqueFiltered.length > 0 ? uniqueFiltered.map((model) => (
                    <tr key={model.id} className="hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[var(--color-brand-50)] flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-600 dark:text-[var(--color-brand-500)]">AI</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)] truncate">{model.name}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)] truncate">{model.provider}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          model.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {model.status}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.api_requests || 0}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.latency != null ? `${model.latency}ms` : '0ms'}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.cost != null ? `$${model.cost.toFixed(2)}/1K` : '$0.00/1K'}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <ModelRowActions model={model} onRun={handleRun} onEdit={handleEdit} onDelete={handleDelete} />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 md:px-6 py-10 text-center text-sm text-slate-400">
                        {search ? `No models match "${search}"` : 'No models available'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
