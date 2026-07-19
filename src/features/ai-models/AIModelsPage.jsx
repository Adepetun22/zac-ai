import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Play, X, Check } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';

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
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[var(--color-text-primary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-canvas)] rounded transition-colors cursor-pointer"
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
        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-[var(--color-brand-500)] hover:bg-indigo-50 dark:hover:bg-[var(--color-brand-50)] rounded transition-colors cursor-pointer"
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

function ModelCard({ model, onRun, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="p-4 bg-white dark:bg-[var(--color-bg-surface)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl space-y-3">
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
          model.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-600 dark:text-[var(--color-text-secondary)]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {model.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Requests</p>
          <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.api_requests || 0}</p>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</p>
          <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.latency != null ? `${model.latency}ms` : '0ms'}</p>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cost</p>
          <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.cost != null ? `$${model.cost.toFixed(2)}` : '$0.00'}</p>
        </div>
      </div>

      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Delete?</span>
            <button
              onClick={() => { onDelete(model.id); setConfirmDelete(false) }}
              className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors cursor-pointer"
              title="Confirm delete"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[var(--color-text-primary)] hover:bg-slate-100 dark:hover:bg-[var(--color-bg-canvas)] rounded-lg transition-colors cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onRun(model)}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-[var(--color-brand-500)] hover:bg-indigo-50 dark:hover:bg-[var(--color-brand-50)] rounded-lg transition-colors cursor-pointer"
              title="Run model"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(model)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Edit model"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Delete model"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIModelsPage() {
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const { 
    aiModels, 
    isLoading, 
    error, 
    addAiModel, 
    deleteAiModel,
    fetchAiModels,
    clearError
  } = useDashboardStore();
  const { user } = useAuthStore();

  // Filter models based on search
  const filtered = aiModels.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.provider.toLowerCase().includes(search.toLowerCase())
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRun = (model) => showToast(`Running ${model.name}...`);
  const handleEdit = (model) => showToast(`Editing ${model.name}`);
  const handleDelete = async (id) => {
    try {
      await deleteAiModel(id);
      showToast(`Model deleted`);
    } catch (error) {
      console.error('Error deleting model:', error);
      showToast(`Error deleting model: ${error.message}`);
    }
  };

  // Load AI models when user is authenticated
  useEffect(() => {
    if (user?.id) {
      fetchAiModels(user.id);
    }
  }, [user?.id, fetchAiModels]);
  
  // Handle loading and error states
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
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 md:bottom-6 right-4 md:right-6 z-50 px-4 py-2.5 bg-slate-900 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-[var(--color-text-primary)]">AI Models</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Manage and monitor your AI model configurations.</p>
        </div>
        <button 
          onClick={() => {
            const newModel = {
              name: `New Model ${Date.now()}`,
              provider: 'OpenAI',
              status: 'inactive',
              latency: 0,
              cost: 0,
              api_requests: 0,
              tokens_processed: 0,
              user_id: user?.id
            };
            addAiModel(newModel);
            showToast('New model added');
          }}
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

        {/* Mobile card view */}
        <div className="min-750:hidden p-3 md:p-4 space-y-3">
          {filtered.length > 0 ? filtered.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onRun={handleRun}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )) : (
            <div className="py-10 text-center text-sm text-slate-400">
              {search ? `No models match "${search}"` : 'No models available'}
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden min-750:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[var(--color-border-subtle)]">
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Requests</th>
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Latency</th>
                <th className="text-left px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cost</th>
                <th className="text-right px-4 md:px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[var(--color-border-subtle)]">
              {filtered.length > 0 ? filtered.map((model) => (
                <tr key={model.id} className="hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors">
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[var(--color-brand-50)] flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-600 dark:text-[var(--color-brand-500)]">AI</span>
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{model.name}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-slate-600 dark:text-[var(--color-text-secondary)]">{model.provider}</td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      model.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 dark:bg-[var(--color-bg-canvas)] text-slate-600 dark:text-[var(--color-text-secondary)]'
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
  );
}