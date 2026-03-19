'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { 
  Plus, Copy, Check, Users, Mail, 
  Building2, ExternalLink, Search,
  RefreshCw, Send, ArrowLeft, FileText,
  Database, BarChart3, Clock, CheckCircle,
  XCircle, ChevronRight
} from 'lucide-react';

interface Client {
  _id: string;
  company_name: string;
  email?: string;
  invite_token?: string;
  invite_sent?: boolean;
  invite_accepted?: boolean;
  created_at?: string;
  subscription_status?: string;
}

interface Tender {
  _id: string;
  tender_name: string;
  client_name?: string;
  status?: string;
  'Created Date'?: string;
  question_count?: number;
}

interface Question {
  _id: string;
  question_text: string;
  generated_answer?: string;
  score?: number;
  status?: string;
}

interface Evidence {
  category: string;
  count: number;
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  
  // Client detail view
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientTenders, setClientTenders] = useState<Tender[]>([]);
  const [clientEvidence, setClientEvidence] = useState<Evidence[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const isAdmin = user?.emailAddresses?.[0]?.emailAddress === 'paul@bidengine.co' ||
                  user?.emailAddresses?.[0]?.emailAddress === 'paul@proofworks.co.uk';

  useEffect(() => {
    if (isLoaded && isAdmin) {
      fetchClients();
    }
  }, [isLoaded, isAdmin]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientDetails = async (client: Client) => {
    setSelectedClient(client);
    setLoadingDetail(true);
    
    try {
      // Fetch tenders for this client
      const tendersRes = await fetch(`/api/admin/clients/${client._id}/tenders`);
      if (tendersRes.ok) {
        const data = await tendersRes.json();
        setClientTenders(data.tenders || []);
      }
      
      // Fetch evidence summary
      const evidenceRes = await fetch(`/api/admin/clients/${client._id}/evidence`);
      if (evidenceRes.ok) {
        const data = await evidenceRes.json();
        setClientEvidence(data.evidence || []);
      }
    } catch (err) {
      console.error('Failed to fetch client details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const createClient = async () => {
    if (!newCompanyName.trim() || creating) return; // Prevent double calls
    
    setCreating(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: newCompanyName.trim(),
          email: newEmail.trim() || undefined,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setClients(prev => [data.client, ...prev]);
        setNewCompanyName('');
        setNewEmail('');
        setShowNewClient(false);
      } else {
        setError(data.error || 'Failed to create client');
      }
    } catch (err) {
      setError('Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  const generateInviteLink = (client: Client) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.bidengine.co';
    return `${baseUrl}/invite/${client.invite_token}`;
  };

  const copyInviteLink = async (client: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = generateInviteLink(client);
    await navigator.clipboard.writeText(link);
    setCopied(client._id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredClients = clients.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">You don't have admin access.</p>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  // Client Detail View
  if (selectedClient) {
    const totalEvidence = clientEvidence.reduce((sum, e) => sum + e.count, 0);
    const avgScore = clientTenders.length > 0 
      ? (clientTenders.reduce((sum, t) => sum + (t.question_count || 0), 0) / clientTenders.length).toFixed(1)
      : '—';

    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedClient(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <Building2 size={20} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{selectedClient.company_name}</h1>
                  <p className="text-gray-500 text-sm">{selectedClient.email || 'No email'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => copyInviteLink(selectedClient, e)}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
              >
                {copied === selectedClient._id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                Copy Invite Link
              </button>
              <Link
                href={`/v/${selectedClient._id}`}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={16} />
                Open Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <FileText size={20} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{clientTenders.length}</p>
                      <p className="text-gray-500 text-sm">Tenders</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Database size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{totalEvidence}</p>
                      <p className="text-gray-500 text-sm">Evidence Items</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      {selectedClient.invite_accepted ? (
                        <CheckCircle size={20} className="text-emerald-400" />
                      ) : (
                        <Clock size={20} className="text-amber-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">
                        {selectedClient.invite_accepted ? 'Active' : 'Pending'}
                      </p>
                      <p className="text-gray-500 text-sm">Status</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <BarChart3 size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">
                        {selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString() : '—'}
                      </p>
                      <p className="text-gray-500 text-sm">Created</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Tenders */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FileText size={18} className="text-cyan-400" />
                      Tenders
                    </h2>
                    <Link 
                      href={`/v/${selectedClient._id}/bidwrite`}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      View All →
                    </Link>
                  </div>
                  
                  {clientTenders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tenders yet</p>
                  ) : (
                    <div className="space-y-2">
                      {clientTenders.slice(0, 5).map((tender) => (
                        <div 
                          key={tender._id}
                          className="flex items-center justify-between p-3 bg-black/30 rounded-lg"
                        >
                          <div>
                            <p className="text-white font-medium">{tender.tender_name || 'Untitled'}</p>
                            <p className="text-gray-500 text-sm">
                              {tender['Created Date'] ? new Date(tender['Created Date']).toLocaleDateString() : ''}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tender.status === 'complete' 
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {tender.status || 'Draft'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BidVault Evidence */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Database size={18} className="text-purple-400" />
                      BidVault Evidence
                    </h2>
                    <Link 
                      href={`/v/${selectedClient._id}/bidvault`}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      View All →
                    </Link>
                  </div>
                  
                  {clientEvidence.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No evidence uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {clientEvidence.map((evidence) => (
                        <div 
                          key={evidence.category}
                          className="flex items-center justify-between p-3 bg-black/30 rounded-lg"
                        >
                          <span className="text-white">{evidence.category}</span>
                          <span className="text-cyan-400 font-medium">{evidence.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Invite Link Section */}
              <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-3">Invite Link</h2>
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-3 bg-black/50 rounded-lg text-cyan-400 font-mono text-sm">
                    {generateInviteLink(selectedClient)}
                  </code>
                  <button
                    onClick={(e) => copyInviteLink(selectedClient, e)}
                    className="px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    {copied === selectedClient._id ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <svg width="140" height="35" viewBox="0 0 200 50" className="drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00d4ff"/>
                    <stop offset="50%" stopColor="#a855f7"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
                <text x="0" y="33" fontFamily="system-ui" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
              </svg>
            </Link>
            <span className="text-gray-500">|</span>
            <span className="text-white font-medium">Admin</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchClients}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Users size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{clients.length}</p>
                <p className="text-gray-500 text-sm">Total Clients</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {clients.filter(c => c.invite_accepted).length}
                </p>
                <p className="text-gray-500 text-sm">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Mail size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {clients.filter(c => c.invite_sent && !c.invite_accepted).length}
                </p>
                <p className="text-gray-500 text-sm">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Building2 size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {clients.filter(c => !c.invite_sent).length}
                </p>
                <p className="text-gray-500 text-sm">Not Invited</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          
          <button
            onClick={() => setShowNewClient(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            New Client
          </button>
        </div>

        {/* New Client Modal */}
        {showNewClient && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Client</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Acme Construction Ltd"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                    autoFocus
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Invite link will be: app.bidengine.co/invite/{newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'companyname'}
                  </p>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Contact Email (optional)</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="contact@acme.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNewClient(false);
                    setNewCompanyName('');
                    setNewEmail('');
                    setError('');
                  }}
                  className="flex-1 py-3 bg-white/5 text-gray-400 font-medium rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createClient}
                  disabled={!newCompanyName.trim() || creating}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clients Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Company</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Email</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Status</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Created</th>
                <th className="text-right text-gray-400 text-sm font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    Loading clients...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    {search ? 'No clients match your search' : 'No clients yet. Create your first one!'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr 
                    key={client._id} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => fetchClientDetails(client)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                          <Building2 size={16} className="text-cyan-400" />
                        </div>
                        <span className="text-white font-medium">{client.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {client.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {client.invite_accepted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                          <Check size={12} /> Active
                        </span>
                      ) : client.invite_sent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                          <Mail size={12} /> Invited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => copyInviteLink(client, e)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title="Copy invite link"
                        >
                          {copied === client._id ? (
                            <Check size={16} className="text-emerald-400" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <ChevronRight size={16} className="text-gray-500" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
