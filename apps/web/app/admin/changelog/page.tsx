'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  adminListChangeLogs,
  adminCreateChangeLog,
  adminDeleteChangeLog,
  adminGetChangeLogStats,
  ChangeLogItem,
  ChangeType,
  CreateChangeLogData,
} from '../../../lib/api';

const TYPE_COLORS: Record<ChangeType, { bg: string; text: string; label: string }> = {
  BUG_FIX: { bg: 'bg-red-100', text: 'text-red-800', label: 'Bug Fix' },
  FEATURE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Feature' },
  ENHANCEMENT: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Enhancement' },
  SECURITY: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Security' },
};

export default function AdminChangelogPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChangeLogItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<ChangeType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: changelogData, isLoading, error } = useQuery({
    queryKey: ['admin', 'changelog', typeFilter, searchQuery],
    queryFn: async () => {
      const filters: { type?: ChangeType; search?: string } = {};
      if (typeFilter) filters.type = typeFilter;
      if (searchQuery) filters.search = searchQuery;
      const { data, error } = await adminListChangeLogs(filters);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'changelog', 'stats'],
    queryFn: async () => {
      const { data, error } = await adminGetChangeLogStats();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminDeleteChangeLog(id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'changelog'] });
    },
  });

  const handleDelete = (item: ChangeLogItem) => {
    if (confirm(`Are you sure you want to delete changelog #${item.number}?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/admin/clinics" className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Change Log</h1>
                  <p className="text-xs text-gray-500">Bug fixes, features, and enhancements</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              + Add Entry
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-white rounded border border-gray-200 p-3">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Changes</div>
            </div>
            {Object.entries(TYPE_COLORS).map(([type, colors]) => (
              <div key={type} className="bg-white rounded border border-gray-200 p-3">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.byType[type] || 0}
                </div>
                <div className={`text-xs ${colors.text}`}>{colors.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by title, description, or resolution..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ChangeType | '')}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="BUG_FIX">Bug Fix</option>
            <option value="FEATURE">Feature</option>
            <option value="ENHANCEMENT">Enhancement</option>
            <option value="SECURITY">Security</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
            Failed to load changelog: {error.message}
          </div>
        )}

        {changelogData && changelogData.items.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No changelog entries yet</h3>
            <p className="text-xs text-gray-500 mb-3">Start documenting changes to the system.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              + Add Entry
            </button>
          </div>
        )}

        {changelogData && changelogData.items.length > 0 && (
          <div className="space-y-3">
            {changelogData.items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">#{item.number}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${TYPE_COLORS[item.type].bg} ${TYPE_COLORS[item.type].text}`}>
                        {TYPE_COLORS[item.type].label}
                      </span>
                      {item.version && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                          v{item.version}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">{item.title}</h3>
                    <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                      <span>{formatDate(item.resolvedAt)}</span>
                      {item.resolvedBy && <span>by {item.resolvedBy}</span>}
                      {item.changedFiles.length > 0 && (
                        <span>{item.changedFiles.length} file(s) changed</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                    className="text-gray-400 hover:text-red-600 p-1"
                    disabled={deleteMutation.isPending}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateChangeLogModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'changelog'] });
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <ChangeLogDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function CreateChangeLogModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateChangeLogData>({
    type: 'BUG_FIX',
    title: '',
    description: '',
    rootCause: '',
    resolution: '',
    changedFiles: [],
    impact: '',
    version: '',
    reportedBy: '',
    resolvedBy: 'Claude Code',
  });
  const [changedFilesText, setChangedFilesText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const changedFiles = changedFilesText
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const { error } = await adminCreateChangeLog({
        ...formData,
        changedFiles,
      });
      if (error) {
        setError(error.message);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to create changelog entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-2.5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-900">Add Changelog Entry</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-3 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ChangeType })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="BUG_FIX">Bug Fix</option>
                  <option value="FEATURE">Feature</option>
                  <option value="ENHANCEMENT">Enhancement</option>
                  <option value="SECURITY">Security</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Version
                </label>
                <input
                  type="text"
                  value={formData.version || ''}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 1.2.3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Brief summary of the change"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Detailed description of the bug/feature..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Root Cause {formData.type === 'BUG_FIX' && '(for bugs)'}
              </label>
              <textarea
                rows={2}
                value={formData.rootCause || ''}
                onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="What caused the issue..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Resolution *
              </label>
              <textarea
                required
                rows={3}
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="How the issue was fixed or feature was implemented..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Changed Files (one per line)
              </label>
              <textarea
                rows={3}
                value={changedFilesText}
                onChange={(e) => setChangedFilesText(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                placeholder="apps/api/src/v1/queue/queue.service.ts&#10;apps/web/lib/api.ts&#10;apps/web/app/p/[token]/page.tsx"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Impact
              </label>
              <textarea
                rows={2}
                value={formData.impact || ''}
                onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Impact on existing functionality..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Reported By
                </label>
                <input
                  type="text"
                  value={formData.reportedBy || ''}
                  onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Who reported the issue"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Resolved By
                </label>
                <input
                  type="text"
                  value={formData.resolvedBy || ''}
                  onChange={(e) => setFormData({ ...formData, resolvedBy: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Who fixed/implemented it"
                />
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-gray-700 hover:text-gray-900 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title || !formData.description || !formData.resolution}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeLogDetailModal({
  item,
  onClose,
}: {
  item: ChangeLogItem;
  onClose: () => void;
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-400">#{item.number}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${TYPE_COLORS[item.type].bg} ${TYPE_COLORS[item.type].text}`}>
                {TYPE_COLORS[item.type].label}
              </span>
              {item.version && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                  v{item.version}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mt-2">{item.title}</h2>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Metadata */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
            <div>
              <span className="text-gray-400">Resolved:</span>{' '}
              <span className="text-gray-700">{formatDate(item.resolvedAt)}</span>
            </div>
            {item.reportedBy && (
              <div>
                <span className="text-gray-400">Reported by:</span>{' '}
                <span className="text-gray-700">{item.reportedBy}</span>
              </div>
            )}
            {item.resolvedBy && (
              <div>
                <span className="text-gray-400">Resolved by:</span>{' '}
                <span className="text-gray-700">{item.resolvedBy}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
          </div>

          {/* Root Cause */}
          {item.rootCause && (
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">Root Cause</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.rootCause}</p>
            </div>
          )}

          {/* Resolution */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">Resolution</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.resolution}</p>
          </div>

          {/* Changed Files */}
          {item.changedFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                Changed Files ({item.changedFiles.length})
              </h3>
              <div className="bg-gray-50 rounded border border-gray-200 p-2">
                <ul className="space-y-1">
                  {item.changedFiles.map((file, idx) => (
                    <li key={idx} className="text-xs font-mono text-gray-700 flex items-center gap-2">
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Impact */}
          {item.impact && (
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">Impact</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.impact}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
