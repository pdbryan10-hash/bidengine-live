'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Database, Search, RefreshCw, Upload,
  Calendar, ChevronDown, Clock, Info, HelpCircle,
  TrendingUp, Users, Shield, Lightbulb, Award,
  Leaf, Package, MessageSquare, BookOpen, AlertTriangle,
  Zap, X, ChevronRight, Building2, Globe
} from 'lucide-react';
import { fetchEvidenceCounts, EvidenceCounts } from '@/lib/bubble';
import ClientBadge from '@/components/ClientBadge';

const CATEGORY_ICONS: Record<string, any> = {
  'FINANCIAL': TrendingUp, 'GOVERNANCE': Shield, 'SOCIAL_VALUE': Users,
  'INNOVATION': Lightbulb, 'QUALITY': Award, 'SAFETY': AlertTriangle,
  'SUSTAINABILITY': Leaf, 'RESOURCE': Users, 'CLIENT_FEEDBACK': MessageSquare,
  'SUPPLY_CHAIN': Package, 'PROGRAMME': Calendar, 'INCIDENT': AlertTriangle,
  'CASE_STUDY': BookOpen, 'KPI': TrendingUp, 'MOBILISATION': Clock, 'OTHER': Database,
};

const CATEGORY_COLOURS: Record<string, string> = {
  'SAFETY': 'text-red-400 bg-red-500/20 border-red-500/30',
  'MOBILISATION': 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  'GOVERNANCE': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  'KPI': 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
  'QUALITY': 'text-green-400 bg-green-500/20 border-green-500/30',
  'FINANCIAL': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  'SOCIAL_VALUE': 'text-pink-400 bg-pink-500/20 border-pink-500/30',
  'SUSTAINABILITY': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  'CLIENT_FEEDBACK': 'text-violet-400 bg-violet-500/20 border-violet-500/30',
  'CASE_STUDY': 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
};

interface RetrievalResult {
  _id: string; title: string; value: string; source_text: string;
  category: string; client_name: string; sector: string; relevance: number;
}

interface EvidenceRecord {
  _id: string; title?: string; value?: string; source_text?: string;
  category?: string; client_name?: string; end_client_name?: string; sector?: string;
  'Created Date'?: string;
}

interface SectorGroup {
  sector_name: string;
  records: EvidenceRecord[];
  categories: string[];
}

interface ContractGroup {
  client_name: string;
  records: EvidenceRecord[];
  categories: string[];
}

function RelevanceBadge({ score }: { score: number }) {
  const colour = score >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 60 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    : score >= 40 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colour}`}>{score}%</span>;
}

function CategoryBadge({ category }: { category: string }) {
  const colour = CATEGORY_COLOURS[category] || 'text-purple-400 bg-purple-500/20 border-purple-500/30';
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wide ${colour}`}>
      {category.replace('_', ' ')}
    </span>
  );
}

export default function BidVaultPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCounts>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'contracts' | 'sectors' | 'retrieval'>('browse');

  // Retrieval state
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalError, setRetrievalError] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Contract grouping state
  const [contracts, setContracts] = useState<ContractGroup[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);
  const [contractSearch, setContractSearch] = useState('');

  // Sector grouping state
  const [sectors, setSectors] = useState<SectorGroup[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [sectorSearch, setSectorSearch] = useState('');

  useEffect(() => {
    async function loadEvidence() {
      setLoading(true);
      const counts = await fetchEvidenceCounts(clientId);
      setEvidenceCounts(counts);
      setLoading(false);
    }
    loadEvidence();
  }, [clientId]);

  useEffect(() => {
    if (activeTab === 'retrieval') setTimeout(() => inputRef.current?.focus(), 100);
    if (activeTab === 'contracts' && contracts.length === 0) loadContracts();
    if (activeTab === 'sectors' && sectors.length === 0) loadSectors();
  }, [activeTab]);

  const loadContracts = async () => {
    setContractsLoading(true);
    try {
      const res = await fetch(`/api/bidvault/records?clientId=${clientId}`);
      const data = await res.json();
      const records: EvidenceRecord[] = data.records || [];

      // Group by client name
      const map = new Map<string, EvidenceRecord[]>();
      for (const r of records) {
        const key = r.client_name || r.end_client_name || 'Unknown Client';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }

      const groups: ContractGroup[] = Array.from(map.entries())
        .map(([client_name, recs]) => ({
          client_name,
          records: recs.sort((a, b) => (b['Created Date'] || '').localeCompare(a['Created Date'] || '')),
          categories: [...new Set(recs.map(r => r.category || 'OTHER'))],
        }))
        .sort((a, b) => b.records.length - a.records.length);

      setContracts(groups);
    } catch {
      // silently fail — user can retry
    } finally {
      setContractsLoading(false);
    }
  };

  const loadSectors = async () => {
    setSectorsLoading(true);
    try {
      const res = await fetch(`/api/bidvault/records?clientId=${clientId}`);
      const data = await res.json();
      const records: EvidenceRecord[] = data.records || [];

      const map = new Map<string, EvidenceRecord[]>();
      for (const r of records) {
        const key = r.sector || 'Unknown Sector';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }

      const groups: SectorGroup[] = Array.from(map.entries())
        .map(([sector_name, recs]) => ({
          sector_name,
          records: recs.sort((a, b) => (b['Created Date'] || '').localeCompare(a['Created Date'] || '')),
          categories: Array.from(new Set(recs.map(r => r.category || 'OTHER'))),
        }))
        .sort((a, b) => b.records.length - a.records.length);

      setSectors(groups);
    } catch {
      // silently fail
    } finally {
      setSectorsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    const counts = await fetchEvidenceCounts(clientId);
    setEvidenceCounts(counts);
    setLoading(false);
    if (activeTab === 'contracts') loadContracts();
    if (activeTab === 'sectors') loadSectors();
  };

  const handleRetrievalSearch = async () => {
    if (!retrievalQuery.trim()) return;
    setRetrievalLoading(true);
    setRetrievalError('');
    setRetrievalResults([]);
    setExpandedId(null);
    try {
      const res = await fetch('/api/bidvault/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, query: retrievalQuery, topK: 15 }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRetrievalResults(data.results || []);
      setTotalRecords(data.total_records || 0);
    } catch {
      setRetrievalError('Search failed. Check your connection and try again.');
    } finally {
      setRetrievalLoading(false);
    }
  };

  const clearRetrieval = () => {
    setRetrievalQuery(''); setRetrievalResults([]); setRetrievalError(''); setExpandedId(null);
    inputRef.current?.focus();
  };

  const totalEvidence = Object.values(evidenceCounts).reduce((sum, t) => sum + t.count, 0);
  const categoriesWithData = Object.values(evidenceCounts).filter(t => t.count > 0).length;

  const filteredCategories = Object.entries(evidenceCounts).filter(([, data]) => {
    if (!searchQuery) return true;
    return data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (data.lastUploadTitle || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const recentUploads = Object.entries(evidenceCounts)
    .filter(([, data]) => data.lastUploadDate && data.count > 0)
    .sort((a, b) => new Date(b[1].lastUploadDate!).getTime() - new Date(a[1].lastUploadDate!).getTime())
    .slice(0, 5);

  const filteredContracts = contracts.filter(c =>
    !contractSearch || c.client_name.toLowerCase().includes(contractSearch.toLowerCase())
  );

  const filteredSectors = sectors.filter(s =>
    !sectorSearch || s.sector_name.toLowerCase().includes(sectorSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/v/${clientId}`)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
                <Database className="text-purple-400" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">BIDVAULT</h1>
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white rounded-md" style={{boxShadow:'0 0 12px rgba(236,72,153,0.4)'}}>BETA</span>
                </div>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">The Evidence Guardian</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ClientBadge clientId={clientId} compact />
            <div className="h-5 w-px bg-white/10" />
            <a href="https://hello.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><Info size={16} />About</a>
            <a href="https://docs.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><HelpCircle size={16} />Help</a>
            <button onClick={() => router.push(`/v/${clientId}`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft size={18} />Back to Dashboard
            </button>
            <button onClick={handleRefresh} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl"><Database className="text-purple-400" size={28} /></div>
                <div>
                  <h2 className="text-xl font-bold text-white">Evidence Library</h2>
                  <p className="text-gray-500 text-sm">Your verified evidence for winning bids</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400">{loading ? '...' : totalEvidence}</div>
                  <div className="text-xs text-gray-500">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-cyan-400">{loading ? '...' : categoriesWithData}</div>
                  <div className="text-xs text-gray-500">Categories</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-400">{loading ? '...' : contracts.length || '—'}</div>
                  <div className="text-xs text-gray-500">Clients</div>
                </div>
                <button
                  onClick={() => router.push(`/v/${clientId}/upload/bidvault`)}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Upload size={18} />Upload Evidence
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/5 p-1 rounded-xl w-fit border border-white/10">
          {([
            { key: 'browse', icon: Database, label: 'Browse Library', colour: 'bg-purple-500/30 text-white border border-purple-500/40' },
            { key: 'contracts', icon: Building2, label: 'By Contract', colour: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
            { key: 'sectors', icon: Globe, label: 'By Sector', colour: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
            { key: 'retrieval', icon: Zap, label: 'Test Retrieval', colour: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? tab.colour : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={16} />{tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* BROWSE TAB */}
          {activeTab === 'browse' && (
            <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              {recentUploads.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Recent Uploads</h3>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-500/20 rounded-xl overflow-hidden">
                    {recentUploads.map(([key, data], index) => {
                      const Icon = CATEGORY_ICONS[key] || Database;
                      return (
                        <div key={key} className={`flex items-center gap-4 p-4 hover:bg-purple-500/5 transition-colors ${index !== recentUploads.length - 1 ? 'border-b border-purple-500/10' : ''}`}>
                          <div className="p-2 bg-purple-500/20 rounded-lg"><Icon size={18} className="text-purple-400" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{data.label}</span>
                              <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">{data.count} records</span>
                            </div>
                            {data.lastUploadTitle && <p className="text-sm text-gray-400 truncate mt-0.5">{data.lastUploadTitle}</p>}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar size={12} />
                            {data.lastUploadDate && new Date(data.lastUploadDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="relative max-w-md">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 transition-colors text-white" />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20"><RefreshCw size={32} className="text-purple-400 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCategories.map(([key, data], index) => {
                    const Icon = CATEGORY_ICONS[key] || Database;
                    return (
                      <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                        onClick={() => data.count > 0 && router.push(`/v/${clientId}/bidvault/${key}`)}
                        className={`bg-gradient-to-br from-purple-900/30 to-purple-800/10 border border-purple-500/30 rounded-xl p-5 transition-all cursor-pointer ${data.count > 0 ? 'hover:border-purple-400/50 hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg"><Icon size={20} className="text-purple-400" /></div>
                            <div>
                              <h3 className="font-semibold text-white">{data.label}</h3>
                              <p className="text-sm text-gray-400">{data.count} records</p>
                            </div>
                          </div>
                          {data.count > 0 && <ChevronDown size={20} className="text-purple-400 -rotate-90" />}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {!loading && totalEvidence === 0 && (
                <div className="text-center py-20">
                  <div className="p-4 bg-purple-500/20 rounded-2xl w-fit mx-auto mb-4"><Database size={48} className="text-purple-400" /></div>
                  <h3 className="text-white font-medium mb-2">No evidence yet</h3>
                  <p className="text-gray-500 text-sm mb-6">Start adding evidence to your library</p>
                  <button onClick={() => router.push(`/v/${clientId}/upload/bidvault`)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
                    Upload Your First Document
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* BY CONTRACT TAB */}
          {activeTab === 'contracts' && (
            <motion.div key="contracts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Building2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-300">All evidence grouped by client. See everything you hold on each contract at a glance.</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="relative max-w-md">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={contractSearch} onChange={e => setContractSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-white" />
                </div>
              </div>

              {contractsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw size={28} className="text-emerald-400 animate-spin" />
                  <p className="text-gray-500 text-sm">Loading all records...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredContracts.map((group, index) => (
                    <motion.div key={group.client_name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                      <button
                        onClick={() => setExpandedContract(expandedContract === group.client_name ? null : group.client_name)}
                        className="w-full flex items-center gap-4 p-4 text-left"
                      >
                        <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0"><Building2 size={18} className="text-emerald-400" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{group.client_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {group.categories.slice(0, 5).map(cat => (
                              <span key={cat} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">{cat.replace('_',' ')}</span>
                            ))}
                            {group.categories.length > 5 && <span className="text-[10px] text-gray-600">+{group.categories.length - 5} more</span>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-400 shrink-0">{group.records.length} records</span>
                        <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${expandedContract === group.client_name ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {expandedContract === group.client_name && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="border-t border-white/10 overflow-hidden">
                            <div className="divide-y divide-white/5">
                              {group.records.map(r => (
                                <div key={r._id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
                                  <CategoryBadge category={r.category || 'OTHER'} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{r.title || '(untitled)'}</p>
                                    {r.value && <p className="text-xs text-cyan-400 truncate">{r.value}</p>}
                                  </div>
                                  <button
                                    onClick={() => router.push(`/v/${clientId}/bidvault/${r.category || 'OTHER'}?highlight=${r._id}`)}
                                    className="shrink-0 text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                                  >
                                    View <ChevronRight size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}

                  {filteredContracts.length === 0 && !contractsLoading && (
                    <div className="text-center py-16 text-gray-600">
                      <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">{contractSearch ? 'No clients match that search' : 'No records found'}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* BY SECTOR TAB */}
          {activeTab === 'sectors' && (
            <motion.div key="sectors" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Globe size={18} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-300">All evidence grouped by sector. See the depth of your experience across markets.</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="relative max-w-md">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={sectorSearch} onChange={e => setSectorSearch(e.target.value)}
                    placeholder="Search sectors..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-amber-500/50 transition-colors text-white" />
                </div>
              </div>

              {sectorsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw size={28} className="text-amber-400 animate-spin" />
                  <p className="text-gray-500 text-sm">Loading all records...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSectors.map((group, index) => (
                    <motion.div key={group.sector_name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                      className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                      <button
                        onClick={() => setExpandedSector(expandedSector === group.sector_name ? null : group.sector_name)}
                        className="w-full flex items-center gap-4 p-4 text-left"
                      >
                        <div className="p-2 bg-amber-500/20 rounded-lg shrink-0"><Globe size={18} className="text-amber-400" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{group.sector_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {group.categories.slice(0, 5).map(cat => (
                              <span key={cat} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">{cat.replace('_', ' ')}</span>
                            ))}
                            {group.categories.length > 5 && <span className="text-[10px] text-gray-600">+{group.categories.length - 5} more</span>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-amber-400 shrink-0">{group.records.length} records</span>
                        <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${expandedSector === group.sector_name ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {expandedSector === group.sector_name && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="border-t border-white/10 overflow-hidden">
                            <div className="divide-y divide-white/5">
                              {group.records.map(r => (
                                <div
                                  key={r._id}
                                  onClick={() => router.push(`/v/${clientId}/bidvault/${r.category || 'OTHER'}?highlight=${r._id}`)}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer group/row"
                                >
                                  <CategoryBadge category={r.category || 'OTHER'} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate group-hover/row:text-amber-300 transition-colors">{r.title || '(untitled)'}</p>
                                    {r.client_name && <p className="text-xs text-gray-500 truncate">{r.client_name}</p>}
                                    {r.value && <p className="text-xs text-amber-400 truncate">{r.value}</p>}
                                  </div>
                                  <ChevronRight size={14} className="shrink-0 text-gray-600 group-hover/row:text-amber-400 transition-colors" />
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}

                  {filteredSectors.length === 0 && !sectorsLoading && (
                    <div className="text-center py-16 text-gray-600">
                      <Globe size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">{sectorSearch ? 'No sectors match that search' : 'No records found'}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* RETRIEVAL PREVIEW TAB */}
          {activeTab === 'retrieval' && (
            <motion.div key="retrieval" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              <div className="mb-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Zap size={18} className="text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-cyan-300 font-medium">What would BidWrite find for this question?</p>
                    <p className="text-xs text-gray-500 mt-1">Uses the same hybrid retrieval as BidWrite — semantic similarity, category boosts, and sector matching.</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex gap-3">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input ref={inputRef} type="text" value={retrievalQuery} onChange={e => setRetrievalQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRetrievalSearch()}
                    placeholder="Paste a bid question — e.g. 'Describe your mobilisation and TUPE approach'"
                    className="w-full pl-10 pr-10 py-3 bg-white/5 border border-cyan-500/30 rounded-xl focus:outline-none focus:border-cyan-500/60 transition-colors text-white placeholder-gray-600" />
                  {retrievalQuery && (
                    <button onClick={clearRetrieval} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
                  )}
                </div>
                <button onClick={handleRetrievalSearch} disabled={!retrievalQuery.trim() || retrievalLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-medium rounded-xl hover:bg-cyan-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {retrievalLoading ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                  {retrievalLoading ? 'Searching...' : 'Run Retrieval'}
                </button>
              </div>

              {retrievalError && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{retrievalError}</div>}

              {retrievalLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw size={28} className="text-cyan-400 animate-spin" />
                  <p className="text-gray-500 text-sm">Running hybrid search...</p>
                </div>
              )}

              {!retrievalLoading && retrievalResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">Top <span className="text-white font-medium">{retrievalResults.length}</span> from <span className="text-white font-medium">{totalRecords}</span> records</p>
                    <p className="text-xs text-gray-600">Click to expand</p>
                  </div>
                  <div className="space-y-3">
                    {retrievalResults.map((result, index) => (
                      <motion.div key={result._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
                        className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                        <button onClick={() => setExpandedId(expandedId === result._id ? null : result._id)}
                          className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/3 transition-colors">
                          <div className="w-6 text-center text-xs text-gray-600 font-mono shrink-0">{index + 1}</div>
                          <div className="shrink-0"><RelevanceBadge score={result.relevance} /></div>
                          <div className="shrink-0"><CategoryBadge category={result.category} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{result.title || '(untitled)'}</p>
                            {result.client_name && <p className="text-xs text-gray-500 truncate mt-0.5">{result.client_name}</p>}
                          </div>
                          {result.value && <p className="text-xs text-gray-500 truncate max-w-[200px] shrink-0 hidden lg:block">{result.value}</p>}
                          <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${expandedId === result._id ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {expandedId === result._id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                              className="border-t border-white/10 overflow-hidden">
                              <div className="p-4 space-y-3 bg-white/2">
                                {result.value && <div><p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Value / Metric</p><p className="text-sm text-cyan-300">{result.value}</p></div>}
                                {result.source_text && <div><p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Source Text</p><p className="text-sm text-gray-300 leading-relaxed">{result.source_text}</p></div>}
                                <div className="flex items-center gap-4 pt-1">
                                  {result.sector && <span className="text-xs text-gray-500">Sector: <span className="text-gray-400">{result.sector}</span></span>}
                                  <span className="text-xs text-gray-600 font-mono">ID: {result._id.slice(-12)}</span>
                                  <button onClick={() => router.push(`/v/${clientId}/bidvault/${result.category}?highlight=${result._id}`)}
                                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors ml-auto">
                                    View in library <ChevronRight size={12} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {!retrievalLoading && retrievalResults.length === 0 && !retrievalQuery && (
                <div className="text-center py-16 text-gray-600">
                  <Zap size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-6">Enter a bid question above to preview retrieval</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Health and safety management system and RIDDOR performance','TUPE transfer and mobilisation approach','PPM compliance and statutory compliance evidence','Social value and community benefit'].map(ex => (
                      <button key={ex} onClick={() => setRetrievalQuery(ex)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors text-left">
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
