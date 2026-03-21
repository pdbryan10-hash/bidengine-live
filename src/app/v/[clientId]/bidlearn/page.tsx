'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Trophy,
  TrendingDown,
  Users,
  RefreshCw,
  CheckCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

import ClientBadge from '@/components/ClientBadge';
import TenderOutcomeButton from '@/components/TenderOutcomeButton';
import { fetchBidOutcomes, fetchBuyerProfiles } from '@/lib/bidlearn';
import { BidOutcome, BuyerProfile } from '@/types';

function WinRateGauge({ rate, size = 56 }: { rate: number; size?: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-white">{pct}%</span>
    </div>
  );
}

export default function BidLearnPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [outcomes, setOutcomes] = useState<BidOutcome[]>([]);
  const [profiles, setProfiles] = useState<BuyerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [o, p] = await Promise.all([
        fetchBidOutcomes(clientId),
        fetchBuyerProfiles(clientId),
      ]);
      setOutcomes(o);
      setProfiles(p);
      setLoading(false);
    }
    load();
  }, [clientId, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const totalOutcomes = outcomes.length;
  const totalWins = outcomes.filter(o => o.outcome === 'win').length;
  const overallWinRate = totalOutcomes > 0 ? Math.round((totalWins / totalOutcomes) * 100) : 0;

  // Derive buyer cards from outcomes when no Bubble profiles exist yet
  const derivedBuyers = outcomes.reduce<Record<string, { wins: number; losses: number; org_type?: string }>>((acc, o) => {
    if (!o.buyer_name) return acc;
    if (!acc[o.buyer_name]) acc[o.buyer_name] = { wins: 0, losses: 0 };
    if (o.outcome === 'win') acc[o.buyer_name].wins++;
    else acc[o.buyer_name].losses++;
    return acc;
  }, {});

  const displayProfiles: (BuyerProfile | { _id: string; buyer_name: string; wins: number; losses: number; total_bids: number; win_rate: number; buyer_org_type?: string; strong_categories?: string; weak_categories?: string })[] =
    profiles.length > 0
      ? profiles
      : Object.entries(derivedBuyers).map(([name, stats]) => ({
          _id: name,
          buyer_name: name,
          wins: stats.wins,
          losses: stats.losses,
          total_bids: stats.wins + stats.losses,
          win_rate: stats.wins / (stats.wins + stats.losses),
        }));

  const buyersTracked = Object.keys(derivedBuyers).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/v/${clientId}`)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                <BarChart3 className="text-cyan-400" size={22} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">BIDLEARN</h1>
                  <span
                    className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white rounded-md"
                    style={{ boxShadow: '0 0 12px rgba(6,182,212,0.4)' }}
                  >
                    BETA
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider">Win / Loss Intelligence</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ClientBadge clientId={clientId} compact />
            <div className="h-5 w-px bg-white/10" />
            <button
              onClick={handleRefresh}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <TenderOutcomeButton
              tenderId=""
              tenderName="Manual Entry"
              clientId={clientId}
              onSuccess={handleRefresh}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Outcomes</p>
            <div className="text-4xl font-bold text-white">
              {loading ? '...' : totalOutcomes}
            </div>
            <p className="text-xs text-gray-500 mt-1">bids recorded</p>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Overall Win Rate</p>
            <div
              className={`text-4xl font-bold ${
                overallWinRate >= 60
                  ? 'text-emerald-400'
                  : overallWinRate >= 40
                  ? 'text-amber-400'
                  : totalOutcomes === 0
                  ? 'text-gray-500'
                  : 'text-red-400'
              }`}
            >
              {loading ? '...' : `${overallWinRate}%`}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {loading ? '' : `${totalWins} win${totalWins !== 1 ? 's' : ''} from ${totalOutcomes} bids`}
            </p>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Buyers Tracked</p>
            <div className="text-4xl font-bold text-cyan-400">
              {loading ? '...' : buyersTracked}
            </div>
            <p className="text-xs text-gray-500 mt-1">buyer profiles</p>
          </div>
        </motion.div>

        {/* Outcomes Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock size={18} className="text-gray-400" />
              Bid Outcomes
            </h2>
          </div>

          {loading ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5">
                  <div className="h-4 bg-white/10 rounded w-1/3" />
                  <div className="h-4 bg-white/10 rounded w-1/4" />
                  <div className="h-4 bg-white/10 rounded w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : outcomes.length === 0 ? (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-12 text-center">
              <BarChart3 className="mx-auto text-gray-500 mb-4" size={48} />
              <h3 className="text-white font-medium mb-2">No outcomes recorded yet</h3>
              <p className="text-gray-500 text-sm mb-6">
                Start recording bid wins and losses to build your intelligence database.
              </p>
              <TenderOutcomeButton tenderId="" tenderName="First Outcome" clientId={clientId} onSuccess={handleRefresh} />
            </div>
          ) : (
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_160px_110px_90px_70px_90px] gap-3 px-4 py-2.5 border-b border-white/10 text-xs text-gray-500 uppercase tracking-wide">
                <span>Tender</span>
                <span>Buyer</span>
                <span>Date</span>
                <span>Result</span>
                <span>Feedback</span>
                <span>Report</span>
              </div>
              {outcomes.map((o, idx) => (
                <motion.div
                  key={o._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`grid grid-cols-[1fr_160px_110px_90px_70px_90px] gap-3 items-center px-4 py-3 transition-colors ${
                    idx !== outcomes.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <Link href={`/v/${clientId}/bidlearn/buyer/${encodeURIComponent(o.buyer_name)}`} className="truncate">
                    <span className="text-white text-sm font-medium hover:text-cyan-400 transition-colors truncate block">{o.tender_name}</span>
                  </Link>
                  <Link href={`/v/${clientId}/bidlearn/buyer/${encodeURIComponent(o.buyer_name)}`}>
                    <span className="text-cyan-400 text-sm truncate block hover:underline">{o.buyer_name}</span>
                  </Link>
                  <span className="text-gray-500 text-xs">
                    {o['Created Date']
                      ? new Date(o['Created Date']).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                  <span>
                    {o.outcome === 'win' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-md text-xs font-semibold">
                        <Trophy size={11} /> WIN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 rounded-md text-xs font-semibold">
                        <TrendingDown size={11} /> LOSS
                      </span>
                    )}
                  </span>
                  <span className="flex justify-center">
                    {o.feedback_processed ? (
                      <span title="Feedback analysed">
                        <CheckCircle size={16} className="text-emerald-400" />
                      </span>
                    ) : o.feedback_raw ? (
                      <span title="Feedback pending">
                        <Clock size={16} className="text-amber-400" />
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white/15 inline-block" title="No feedback" />
                    )}
                  </span>
                  <span>
                    {o.tender ? (
                      <Link
                        href={`/v/${clientId}/bidlearn/outcome/${o._id}`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40"
                      >
                        <ChevronRight size={11} /> Report
                      </Link>
                    ) : (
                      <span className="text-gray-700 text-xs">—</span>
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Buyer Intelligence */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              Buyer Intelligence
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
                  <div className="h-5 bg-white/10 rounded w-2/3 mb-4" />
                  <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : displayProfiles.length === 0 ? (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-8 text-center">
              <Users className="mx-auto text-gray-500 mb-3" size={36} />
              <p className="text-gray-400 text-sm">
                Record your first bid outcome to start tracking buyers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProfiles.map((profile, idx) => (
                <motion.div
                  key={profile._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                >
                  <Link
                    href={`/v/${clientId}/bidlearn/buyer/${encodeURIComponent(profile.buyer_name)}`}
                    className="group block bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 transition-all hover:translate-y-[-2px]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate group-hover:text-cyan-400 transition-colors">
                          {profile.buyer_name}
                        </h3>
                        {profile.buyer_org_type && (
                          <p className="text-gray-500 text-xs mt-0.5">{profile.buyer_org_type}</p>
                        )}
                      </div>
                      <WinRateGauge rate={profile.win_rate} size={52} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span>{profile.total_bids} bid{profile.total_bids !== 1 ? 's' : ''}</span>
                      <span className="text-emerald-400">{profile.wins}W</span>
                      <span className="text-red-400">{profile.losses}L</span>
                    </div>

                    {profile.strong_categories && (
                      <div className="mb-2">
                        <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Strong</p>
                        <div className="flex flex-wrap gap-1">
                          {profile.strong_categories.split(',').slice(0, 3).map(cat => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium"
                            >
                              {cat.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profile.weak_categories && (
                      <div className="mb-3">
                        <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Weak</p>
                        <div className="flex flex-wrap gap-1">
                          {profile.weak_categories.split(',').slice(0, 3).map(cat => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] font-medium"
                            >
                              {cat.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end">
                      <span className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-cyan-400 transition-colors">
                        View profile <ChevronRight size={13} />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
