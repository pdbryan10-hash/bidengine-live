'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronDown, Shield, Users, Search } from 'lucide-react';
import { fetchAllClients } from '@/lib/bubble';

interface Client {
  _id: string;
  client_id: number;
  client_name: string;
  email?: string;
  subscription_status?: string;
}

interface AdminClientSelectorProps {
  currentClientName: string;
}

export default function AdminClientSelector({ currentClientName }: AdminClientSelectorProps) {
  const router = useRouter();
  const params = useParams();
  const currentClientId = params.clientId as string;
  
  const [isOpen, setIsOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load clients when dropdown opens
  useEffect(() => {
    if (isOpen && clients.length === 0) {
      setLoading(true);
      fetchAllClients().then(data => {
        setClients(data);
        setLoading(false);
      });
    }
  }, [isOpen, clients.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients.filter(client => 
    client.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectClient = (clientId: string) => {
    setIsOpen(false);
    setSearch('');
    // Navigate to the selected client's dashboard
    router.push(`/v/${clientId}`);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'trialing': return 'bg-blue-500';
      case 'expired':
      case 'canceled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Admin Badge & Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
      >
        <Shield className="text-amber-400" size={14} />
        <span className="text-amber-400 text-sm font-medium">Admin</span>
        <span className="text-white/60 text-sm">|</span>
        <span className="text-white text-sm font-medium max-w-[150px] truncate">
          {currentClientName || 'Select Client'}
        </span>
        <ChevronDown 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          size={14} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Users size={12} />
              <span>Switch Client View</span>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
            </div>
          </div>

          {/* Client List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                Loading clients...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No clients found
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client._id}
                  onClick={() => handleSelectClient(client._id)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${
                    client._id === currentClientId ? 'bg-amber-500/10' : ''
                  }`}
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(client.subscription_status)}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {client.client_name || 'Unnamed Client'}
                    </div>
                    {client.email && (
                      <div className="text-gray-500 text-xs truncate">
                        {client.email}
                      </div>
                    )}
                  </div>

                  {/* Current indicator */}
                  {client._id === currentClientId && (
                    <span className="text-amber-400 text-xs">Current</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/5">
            <div className="text-gray-500 text-xs">
              {clients.length} total clients
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
