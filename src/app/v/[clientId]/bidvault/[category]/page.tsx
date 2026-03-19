'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Database, Search, RefreshCw, ChevronDown, ChevronUp,
  Calendar, FileText, Info, HelpCircle, ExternalLink
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { fetchEvidenceRecords, getTableConfig, EVIDENCE_TABLES } from '@/lib/bubble';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  const category = params.category as string;
  const highlightRecordId = searchParams.get('record');

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Get table config
  const tableConfig = getTableConfig(category);
  const tableLabel = tableConfig?.label || category.replace(/_/g, ' ');

  useEffect(() => {
    async function loadRecords() {
      setLoading(true);
      const data = await fetchEvidenceRecords(category, clientId);
      setRecords(data);
      setLoading(false);
      
      // Auto-expand highlighted record from URL
      if (highlightRecordId) {
        setExpandedRecord(highlightRecordId);
      }
    }
    loadRecords();
  }, [category, clientId, highlightRecordId]);

  // Scroll to highlighted record once it renders
  useEffect(() => {
    if (highlightRecordId && !loading && records.length > 0 && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightRecordId, loading, records]);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await fetchEvidenceRecords(category, clientId);
    setRecords(data);
    setLoading(false);
  };

  // Filter records by search
  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return Object.values(record).some(value => 
      String(value).toLowerCase().includes(searchLower)
    );
  });

  // Get display title for a record
  const getRecordTitle = (record: any) => {
    if (tableConfig?.titleField && record[tableConfig.titleField]) {
      return record[tableConfig.titleField];
    }
    return record.project_id || record._id?.substring(0, 12) || 'Record';
  };

  // Get narrative/description for a record
  const getRecordNarrative = (record: any) => {
    if (tableConfig?.narrativeField && record[tableConfig.narrativeField]) {
      return record[tableConfig.narrativeField];
    }
    return null;
  };

  // Get all displayable fields (exclude system fields)
  const getDisplayFields = (record: any) => {
    const excludeFields = ['_id', 'Created By', 'Modified Date', 'Created Date', 'project_id'];
    return Object.entries(record).filter(([key, value]) => 
      !excludeFields.includes(key) && 
      !key.toLowerCase().includes('embed') &&
      value !== null && 
      value !== undefined && 
      value !== '' &&
      typeof value !== 'object'
    );
  };

  // Format field name for display
  const formatFieldName = (field: string) => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  // Format field value for display
  const formatFieldValue = (value: any) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push(`/v/${clientId}/bidvault`)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            {/* BidVault Logo */}
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
            <a 
              href="https://hello.bidengine.co" 
              target="_blank" 
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <Info size={16} />
              About
            </a>
            <a 
              href="https://docs.bidengine.co" 
              target="_blank" 
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <HelpCircle size={16} />
              Help
            </a>
            <button
              onClick={() => router.push(`/v/${clientId}/bidvault`)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
              Back to BidVault
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
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

        {/* Search */}
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

        {/* Records List */}
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
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'Try a different search term' : 'No evidence in this category yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record, index) => {
              const isExpanded = expandedRecord === record._id;
              const title = getRecordTitle(record);
              const narrative = getRecordNarrative(record);
              const displayFields = getDisplayFields(record);

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
                  {/* Record Header - Always visible */}
                  <button
                    onClick={() => setExpandedRecord(isExpanded ? null : record._id)}
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
                              {new Date(record['Created Date']).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          )}
                          <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                            {displayFields.length} fields
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp size={20} className="text-purple-400" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-500" />
                        )}
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
                          {/* Narrative at top if exists */}
                          {narrative && (
                            <div className="mb-4 p-3 bg-purple-500/10 rounded-lg">
                              <p className="text-sm text-gray-300 whitespace-pre-wrap">{narrative}</p>
                            </div>
                          )}

                          {/* All Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {displayFields.map(([key, value]) => (
                              <div key={key} className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-purple-400 mb-1">{formatFieldName(key)}</div>
                                <div className="text-sm text-white break-words">
                                  {formatFieldValue(value)}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Record ID */}
                          <div className="mt-4 pt-3 border-t border-purple-500/10">
                            <span className="text-xs text-gray-600">ID: {record._id}</span>
                          </div>
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
