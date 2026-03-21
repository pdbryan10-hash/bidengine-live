'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { UserButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Database, Search, RefreshCw, ChevronDown, ChevronUp,
  Calendar, FileText, Info, HelpCircle, Edit2, Trash2, Save, X, Check
} from 'lucide-react';

// Health score: 0-5 based on record completeness
function getHealthScore(record: any): { score: number; label: string; colour: string } {
  let score = 0;
  if (record.value && /\d/.test(String(record.value))) score += 2;
  if (record.client_name || record.end_client_name) score += 1;
  if (record.source_text && String(record.source_text).length > 60) score += 1;
  if (record.sector) score += 1;
  const label = score >= 4 ? 'Strong' : score >= 2 ? 'OK' : 'Weak';
  const colour = score >= 4 ? 'text-emerald-400' : score >= 2 ? 'text-amber-400' : 'text-red-400';
  return { score, label, colour };
}

function HealthDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < score
              ? score >= 4 ? 'bg-emerald-400' : score >= 2 ? 'bg-amber-400' : 'bg-red-400'
              : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

import { fetchEvidenceRecords, getTableConfig } from '@/lib/bubble';

interface EditValues {
  title: string;
  value: string;
  client_name: string;
  sector: string;
  source_text: string;
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  const category = params.category as string;
  const highlightRecordId = searchParams.get('highlight');

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ title: '', value: '', client_name: '', sector: '', source_text: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tableConfig = getTableConfig(category);
  const tableLabel = tableConfig?.label || category.replace(/_/g, ' ');

  useEffect(() => {
    async function loadRecords() {
      setLoading(true);
      const data = await fetchEvidenceRecords(category, clientId);
      setRecords(data);
      setLoading(false);
      if (highlightRecordId) setExpandedRecord(highlightRecordId);
    }
    loadRecords();
  }, [category, clientId, highlightRecordId]);

  useEffect(() => {
    if (highlightRecordId && !loading && records.length > 0 && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [highlightRecordId, loading, records]);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await fetchEvidenceRecords(category, clientId);
    setRecords(data);
    setLoading(false);
  };

  const startEdit = (record: any) => {
    setEditingId(record._id);
    setEditValues({
      title: record.title || '',
      value: record.value || '',
      client_name: record.client_name || '',
      sector: record.sector || '',
      source_text: record.source_text || '',
    });
    setSaveError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError('');
  };

  const handleSave = async (recordId: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/bidvault/record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, category, ...editValues }),
      });
      if (!res.ok) throw new Error();
      // Update local state
      setRecords(prev => prev.map(r =>
        r._id === recordId ? { ...r, ...editValues } : r
      ));
      setEditingId(null);
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    setDeleting(true);
    try {
      const res = await fetch('/api/bidvault/record', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.filter(r => r._id !== recordId));
      setExpandedRecord(null);
      setConfirmDeleteId(null);
    } catch {
      // silently fail — leave record in place
    } finally {
      setDeleting(false);
    }
  };

  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return Object.values(record).some(value =>
      String(value).toLowerCase().includes(searchLower)
    );
  });

  const getRecordTitle = (record: any) => {
    if (tableConfig?.titleField && record[tableConfig.titleField]) return record[tableConfig.titleField];
    return record.project_id || record._id?.substring(0, 12) || 'Record';
  };

  const getRecordNarrative = (record: any) => {
    if (tableConfig?.narrativeField && record[tableConfig.narrativeField]) return record[tableConfig.narrativeField];
    return null;
  };

  const getDisplayFields = (record: any) => {
    const excludeFields = ['_id', 'Created By', 'Modified Date', 'Created Date', 'project_id'];
    return Object.entries(record).filter(([key, value]) =>
      !excludeFields.includes(key) &&
      !key.toLowerCase().includes('embed') &&
      value !== null && value !== undefined && value !== '' &&
      typeof value !== 'object'
    );
  };

  const formatFieldName = (field: string) =>
    field.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')
      .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();

  const formatFieldValue = (value: any) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/v/${clientId}/bidvault`)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
                <Database className="text-purple-400" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{tableLabel}</h1>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">BidVault Evidence</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://hello.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><Info size={16} />About</a>
            <a href="https://docs.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><HelpCircle size={16} />Help</a>
            <button onClick={() => router.push(`/v/${clientId}/bidvault`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft size={18} />Back to BidVault
            </button>
            <button onClick={handleRefresh} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-purple-400" size={20} />
                <span className="text-white font-medium">{tableLabel}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-purple-400 font-bold text-lg">{records.length}</span>
                <span className="text-gray-500 text-sm">records</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${tableLabel.toLowerCase()}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 transition-colors text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={32} className="text-purple-400 animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <div className="p-4 bg-purple-500/20 rounded-2xl w-fit mx-auto mb-4">
              <Database size={48} className="text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-2">No records found</h3>
            <p className="text-gray-500 text-sm">{searchQuery ? 'Try a different search term' : 'No evidence in this category yet'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record, index) => {
              const isExpanded = expandedRecord === record._id;
              const isEditing = editingId === record._id;
              const isConfirmingDelete = confirmDeleteId === record._id;
              const title = getRecordTitle(record);
              const narrative = getRecordNarrative(record);
              const displayFields = getDisplayFields(record);
              const health = getHealthScore(record);

              return (
                <motion.div
                  key={record._id}
                  ref={record._id === highlightRecordId ? highlightRef : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`bg-gradient-to-br from-purple-900/20 to-purple-800/10 border rounded-xl overflow-hidden hover:border-purple-400/40 transition-colors ${
                    record._id === highlightRecordId
                      ? 'border-cyan-500/50 ring-2 ring-cyan-500/30'
                      : 'border-purple-500/20'
                  }`}
                >
                  {/* Record Header */}
                  <button
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedRecord(isExpanded ? null : record._id);
                      setConfirmDeleteId(null);
                    }}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{title}</h3>
                        {narrative && !isExpanded && (
                          <p className="text-sm text-gray-400 line-clamp-2 mt-1">{narrative}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          {record['Created Date'] && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar size={12} />
                              {new Date(record['Created Date']).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">{displayFields.length} fields</span>
                          <HealthDots score={health.score} />
                          <span className={`text-xs ${health.colour}`}>{health.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp size={20} className="text-purple-400" /> : <ChevronDown size={20} className="text-gray-500" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-purple-500/20"
                      >
                        <div className="p-4 bg-black/30">
                          {isEditing ? (
                            /* Edit Form */
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {([
                                  { key: 'title', label: 'Title', multiline: false },
                                  { key: 'client_name', label: 'Client Name', multiline: false },
                                  { key: 'value', label: 'Value / Metric', multiline: false },
                                  { key: 'sector', label: 'Sector', multiline: false },
                                ] as const).map(({ key, label }) => (
                                  <div key={key}>
                                    <label className="text-xs text-purple-400 mb-1 block">{label}</label>
                                    <input
                                      type="text"
                                      value={editValues[key]}
                                      onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400/60 transition-colors"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div>
                                <label className="text-xs text-purple-400 mb-1 block">Source Text / Narrative</label>
                                <textarea
                                  value={editValues.source_text}
                                  onChange={e => setEditValues(prev => ({ ...prev, source_text: e.target.value }))}
                                  rows={4}
                                  className="w-full px-3 py-2 bg-white/5 border border-purple-500/30 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400/60 transition-colors resize-none"
                                />
                              </div>
                              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleSave(record._id)}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                                >
                                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
                                >
                                  <X size={14} />Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View Mode */
                            <>
                              {narrative && (
                                <div className="mb-4 p-3 bg-purple-500/10 rounded-lg">
                                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{narrative}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {displayFields.map(([key, value]) => (
                                  <div key={key} className="bg-white/5 rounded-lg p-3">
                                    <div className="text-xs text-purple-400 mb-1">{formatFieldName(key)}</div>
                                    <div className="text-sm text-white break-words">{formatFieldValue(value)}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 pt-3 border-t border-purple-500/10 flex items-center justify-between">
                                <span className="text-xs text-gray-600">ID: {record._id}</span>

                                {isConfirmingDelete ? (
                                  /* Delete confirmation */
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-red-400">Delete this record?</span>
                                    <button
                                      onClick={() => handleDelete(record._id)}
                                      disabled={deleting}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                    >
                                      {deleting ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                      {deleting ? 'Deleting...' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs rounded-lg hover:text-white transition-colors"
                                    >
                                      <X size={12} />Cancel
                                    </button>
                                  </div>
                                ) : (
                                  /* Edit / Delete actions */
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => startEdit(record)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/25 transition-colors"
                                    >
                                      <Edit2 size={12} />Edit
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(record._id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors"
                                    >
                                      <Trash2 size={12} />Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
