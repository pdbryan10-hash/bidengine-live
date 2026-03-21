'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Trophy,
  TrendingDown,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import ClientBadge from '@/components/ClientBadge';
import { fetchBuyerProfile, fetchOutcomeInsights, fetchBidOutcomes } from '@/lib/bidlearn';
import { BuyerProfile, OutcomeInsight, BidOutcome } from '@/types';

function WinRateGauge({ rate, size = 100 }: { rate: number; size?: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-white">{pct}%</div>
        <div className="text-xs text-gray-500">win rate</div>
      </div>
    </div>
  );
}

export default function BuyerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const buyerNameEncoded = params.buyerName as string;
  const buyerName = decodeURIComponent(buyerNameEncoded);

  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [insights, setInsights] = useState<OutcomeInsight[]>([]);
  const [outcomes, setOutcomes] = useState<BidOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [p, ins, out] = await Promise.all([
      fetchBuyerProfile(clientId, buyerName),
      fetchOutcomeInsights(clientId, buyerName),
      fetchBidOutcomes(clientId),
    ]);
    setProfile(p);
    setInsights(ins);
    // Filter outcomes for this buyer
    setOutcomes(out.filter(o => o.buyer_name === buyerName));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [clientId, buyerName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshProfile = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/bidlearn/update-buyer-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, buyer_name: buyerName }),
      });
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const positiveInsights = insights.filter(i => i.insight_type === 'positive');
  const negativeInsights = insights.filter(i => i.insight_type === 'negative');

  // Compute stats directly from outcomes as fallback when Buyer_Profile is empty
  const derivedWins = outcomes.filter(o => o.outcome === 'win').length;
  const derivedLosses = outcomes.filter(o => o.outcome === 'loss').length;
  const derivedTotal = outcomes.length;
  const derivedWinRate = derivedTotal > 0 ? derivedWins / derivedTotal : 0;

  const totalBids = (profile?.total_bids && profile.total_bids > 0) ? profile.total_bids : derivedTotal;
  const wins = (profile?.wins !== undefined && profile.wins > 0) ? profile.wins : derivedWins;
  const losses = (profile?.losses !== undefined && profile.losses > 0) ? profile.losses : derivedLosses;
  const winRate = (profile?.win_rate !== undefined && profile.win_rate > 0) ? profile.win_rate : derivedWinRate;
  const lastOutcome = profile?.last_outcome || (outcomes[0]?.outcome ?? null);

  let resonantPhrases: string[] = [];
  if (profile?.resonant_phrases) {
    try {
      resonantPhrases = JSON.parse(profile.resonant_phrases);
    } catch {
      resonantPhrases = [];
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/v/${clientId}/bidlearn`)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                <BarChart3 className="text-cyan-400" size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white truncate max-w-xs">{buyerName}</h1>
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider">Buyer Intelligence Profile</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ClientBadge clientId={clientId} compact />
            <button
              onClick={handleRefreshProfile}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors text-sm text-gray-300 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              Refresh Profile
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={32} className="text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border border-cyan-500/20 rounded-2xl p-6 mb-6"
            >
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                {/* Win Rate Gauge */}
                <div className="flex-shrink-0">
                  <WinRateGauge rate={winRate} size={100} />
                </div>

                {/* Stats */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white">{buyerName}</h2>
                    {profile?.buyer_org_type && (
                      <span className="px-2 py-0.5 bg-white/10 text-gray-300 rounded text-xs">
                        {profile.buyer_org_type}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500">Total bids:</span>
                      <span className="text-white font-semibold">{totalBids}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Trophy size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">{wins} wins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingDown size={14} className="text-red-400" />
                      <span className="text-red-400 font-semibold">{losses} losses</span>
                    </div>
                    {lastOutcome && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Last outcome:</span>
                        <span
                          className={
                            lastOutcome === 'win' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                          }
                        >
                          {lastOutcome.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Profile Summary */}
                  {profile?.profile_summary && (
                    <p className="text-gray-300 text-sm leading-relaxed">{profile.profile_summary}</p>
                  )}

                  {profile?.profile_updated && (
                    <p className="text-gray-600 text-xs mt-2">
                      Profile updated{' '}
                      {new Date(profile.profile_updated).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Strong / Weak Categories */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
            >
              <div className="bg-gradient-to-br from-emerald-900/20 to-transparent border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Strong Categories</h3>
                </div>
                {profile?.strong_categories ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.strong_categories.split(',').map(cat => (
                      <span
                        key={cat}
                        className="px-3 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-semibold"
                      >
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No data yet — record outcomes with feedback to build this.</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-red-900/20 to-transparent border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-white">Weak Categories</h3>
                </div>
                {profile?.weak_categories ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.weak_categories.split(',').map(cat => (
                      <span
                        key={cat}
                        className="px-3 py-1 bg-red-500/15 text-red-400 rounded-lg text-xs font-semibold"
                      >
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No weak categories identified yet.</p>
                )}
              </div>
            </motion.div>

            {/* Resonant Phrases */}
            {resonantPhrases.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-500/20 rounded-2xl p-5 mb-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Resonant Phrases</h3>
                  <span className="text-xs text-gray-500">— language that scored well with this buyer</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resonantPhrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-xl text-xs"
                    >
                      &ldquo;{phrase}&rdquo;
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Evaluator Insights */}
            {insights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <MessageSquare size={16} className="text-gray-400" />
                  Evaluator Feedback Insights
                </h3>

                {positiveInsights.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-emerald-400 uppercase tracking-wide mb-2 font-medium">
                      Positive ({positiveInsights.length})
                    </p>
                    <div className="space-y-2">
                      {positiveInsights.slice(0, 6).map(ins => (
                        <div
                          key={ins._id}
                          className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl"
                        >
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold whitespace-nowrap mt-0.5">
                            {ins.category}
                          </span>
                          <div className="flex-1 min-w-0">
                            {ins.insight_text && (
                              <p className="text-gray-300 text-xs leading-relaxed">&ldquo;{ins.insight_text}&rdquo;</p>
                            )}
                            {ins.resonant_phrase && (
                              <p className="text-emerald-400 text-xs mt-1 font-medium">
                                Key phrase: &ldquo;{ins.resonant_phrase}&rdquo;
                              </p>
                            )}
                            {ins.score_awarded != null && ins.score_max != null && (
                              <p className="text-gray-500 text-xs mt-1">
                                Score: {ins.score_awarded}/{ins.score_max}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {negativeInsights.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 uppercase tracking-wide mb-2 font-medium">
                      Areas for Improvement ({negativeInsights.length})
                    </p>
                    <div className="space-y-2">
                      {negativeInsights.slice(0, 6).map(ins => (
                        <div
                          key={ins._id}
                          className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/15 rounded-xl"
                        >
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold whitespace-nowrap mt-0.5">
                            {ins.category}
                          </span>
                          <div className="flex-1 min-w-0">
                            {ins.insight_text && (
                              <p className="text-gray-300 text-xs leading-relaxed">&ldquo;{ins.insight_text}&rdquo;</p>
                            )}
                            {ins.improvement_note && (
                              <p className="text-amber-400 text-xs mt-1 font-medium">
                                Fix: {ins.improvement_note}
                              </p>
                            )}
                            {ins.score_awarded != null && ins.score_max != null && (
                              <p className="text-gray-500 text-xs mt-1">
                                Score: {ins.score_awarded}/{ins.score_max}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Bid History Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Clock size={16} className="text-gray-400" />
                Bid History with {buyerName}
              </h3>

              {outcomes.length === 0 ? (
                <div className="bg-white/5 border border-white/10 border-dashed rounded-xl p-6 text-center">
                  <p className="text-gray-500 text-sm">No bid history recorded for this buyer yet.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/10" />
                  <div className="space-y-3">
                    {outcomes.map((o, idx) => (
                      <motion.div
                        key={o._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-start gap-4"
                      >
                        {/* Dot */}
                        <div
                          className={`relative z-10 w-10 h-10 flex-shrink-0 rounded-full border flex items-center justify-center ${
                            o.outcome === 'win'
                              ? 'bg-emerald-500/20 border-emerald-500/50'
                              : 'bg-red-500/20 border-red-500/50'
                          }`}
                        >
                          {o.outcome === 'win' ? (
                            <Trophy size={16} className="text-emerald-400" />
                          ) : (
                            <TrendingDown size={16} className="text-red-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-white text-sm font-medium">{o.tender_name}</p>
                            <span className="text-gray-500 text-xs whitespace-nowrap">
                              {o['Created Date']
                                ? new Date(o['Created Date']).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span
                              className={
                                o.outcome === 'win'
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-red-400 font-semibold'
                              }
                            >
                              {o.outcome.toUpperCase()}
                            </span>
                            {o.contract_value && (
                              <span className="text-gray-500">
                                £{o.contract_value.toLocaleString()}
                              </span>
                            )}
                            {o.tender_sector && (
                              <span className="text-gray-600">{o.tender_sector}</span>
                            )}
                            {o.feedback_processed && (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle size={11} /> Feedback analysed
                              </span>
                            )}
                          </div>
                          {o.notes && (
                            <p className="text-gray-500 text-xs mt-1.5 italic">{o.notes}</p>
                          )}
                          {o.tender && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <Link
                                href={`/v/${clientId}/bidlearn/outcome/${o._id}`}
                                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                <FileText size={11} />
                                View Q-by-Q Report
                              </Link>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
