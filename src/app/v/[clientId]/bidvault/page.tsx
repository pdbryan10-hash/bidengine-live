'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Database, Search, RefreshCw, Upload,
  FileText, Calendar, ChevronDown, Clock, Info, HelpCircle,
  TrendingUp, Users, Shield, Lightbulb, Award,
  Leaf, Package, MessageSquare, BookOpen, AlertTriangle
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';
import { fetchEvidenceCounts, EvidenceCounts, EvidenceTableData } from '@/lib/bubble';
import ClientBadge from '@/components/ClientBadge';

const CATEGORY_ICONS: Record<string, any> = {
  'FINANCIAL': TrendingUp,
  'GOVERNANCE': Shield,
  'SOCIAL_VALUE': Users,
  'INNOVATION': Lightbulb,
  'QUALITY': Award,
  'SAFETY': AlertTriangle,
  'SUSTAINABILITY': Leaf,
  'RESOURCE': Users,
  'CLIENT_FEEDBACK': MessageSquare,
  'SUPPLY_CHAIN': Package,
  'PROGRAMME': Calendar,
  'INCIDENT': AlertTriangle,
  'CASE_STUDY': BookOpen,
  'KPI': TrendingUp,
  'MOBILISATION': Clock,
  'OTHER': Database,
};

export default function BidVaultPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCounts>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadEvidence() {
      setLoading(true);
      const counts = await fetchEvidenceCounts(clientId);
      setEvidenceCounts(counts);
      setLoading(false);
    }
    loadEvidence();
  }, [clientId]);

  const handleRefresh = async () => {
    setLoading(true);
    const counts = await fetchEvidenceCounts(clientId);
    setEvidenceCounts(counts);
    setLoading(false);
  };

  const totalEvidence = Object.values(evidenceCounts).reduce((sum, t) => sum + t.count, 0);
  const categoriesWithData = Object.values(evidenceCounts).filter(t => t.count > 0).length;

  // Filter categories
  const filteredCategories = Object.entries(evidenceCounts).filter(([key, data]) => {
    if (searchQuery === '') return true;
    return data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (data.lastUploadTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           (data.lastUploadNarrative || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Get recent uploads (categories with dates, sorted by most recent)
  const recentUploads = Object.entries(evidenceCounts)
    .filter(([_, data]) => data.lastUploadDate && data.count > 0)
    .sort((a, b) => new Date(b[1].lastUploadDate!).getTime() - new Date(a[1].lastUploadDate!).getTime())
    .slice(0, 5);

  const getIconForCategory = (key: string) => {
    const Icon = CATEGORY_ICONS[key] || Database;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header - Matching Dashboard */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push(`/v/${clientId}`)}
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
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">BIDVAULT</h1>
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white rounded-md" style={{boxShadow: '0 0 12px rgba(236,72,153,0.4)'}}>BETA</span>
                </div>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">The Evidence Guardian</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ClientBadge clientId={clientId} compact />
            <div className="h-5 w-px bg-white/10" />
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
              onClick={() => router.push(`/v/${clientId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
              Back to Dashboard
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
        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Database className="text-purple-400" size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Evidence Library</h2>
                  <p className="text-gray-500 text-sm">Your verified evidence for winning bids</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400">
                    {loading ? '...' : totalEvidence}
                  </div>
                  <div className="text-xs text-gray-500">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-cyan-400">
                    {loading ? '...' : categoriesWithData}
                  </div>
                  <div className="text-xs text-gray-500">Categories</div>
                </div>
                <button
                  onClick={() => router.push(`/v/${clientId}/upload/bidvault`)}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Upload size={18} />
                  Upload Evidence
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Uploads Section */}
        {recentUploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Recent Uploads</h3>
            </div>
            <div className="bg-gradient-to-br from-purple-900/10 to-transparent border border-purple-500/20 rounded-xl overflow-hidden">
              {recentUploads.map(([key, data], index) => {
                const Icon = getIconForCategory(key);
                return (
                  <div 
                    key={key}
                    className={`flex items-center gap-4 p-4 hover:bg-purple-500/5 transition-colors ${
                      index !== recentUploads.length - 1 ? 'border-b border-purple-500/10' : ''
                    }`}
                  >
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Icon size={18} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{data.label}</span>
                        <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                          {data.count} records
                        </span>
                      </div>
                      {data.lastUploadTitle && (
                        <p className="text-sm text-gray-400 truncate mt-0.5">{data.lastUploadTitle}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar size={12} />
                        {data.lastUploadDate && new Date(data.lastUploadDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search evidence categories..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 transition-colors text-white"
            />
          </div>
        </div>

        {/* Categories Grid - ALL PURPLE */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={32} className="text-purple-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map(([key, data], index) => {
              const Icon = getIconForCategory(key);

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => data.count > 0 && router.push(`/v/${clientId}/bidvault/${key}`)}
                  className={`bg-gradient-to-br from-purple-900/30 to-purple-800/10 border border-purple-500/30 rounded-xl overflow-hidden transition-all cursor-pointer ${
                    data.count > 0 ? 'hover:border-purple-400/50 hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-full p-5 text-left">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <Icon size={20} className="text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{data.label}</h3>
                          <p className="text-sm text-gray-400">{data.count} records</p>
                        </div>
                      </div>
                      {data.count > 0 && (
                        <ChevronDown 
                          size={20} 
                          className="text-purple-400 -rotate-90"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && totalEvidence === 0 && (
          <div className="text-center py-20">
            <div className="p-4 bg-purple-500/20 rounded-2xl w-fit mx-auto mb-4">
              <Database size={48} className="text-purple-400" />
            </div>
            <h3 className="text-white font-medium mb-2">No evidence yet</h3>
            <p className="text-gray-500 text-sm mb-6">Start adding evidence to your library</p>
            <button
              onClick={() => router.push(`/v/${clientId}/upload/bidvault`)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              Upload Your First Document
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
