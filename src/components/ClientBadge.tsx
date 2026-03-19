'use client';

import { useEffect, useState } from 'react';
import { fetchClientById } from '@/lib/bubble';
import { Building2, Hash } from 'lucide-react';

interface ClientBadgeProps {
  clientId: string;
  compact?: boolean;
}

export default function ClientBadge({ clientId, compact = false }: ClientBadgeProps) {
  const [clientName, setClientName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      const client = await fetchClientById(clientId);
      if (client) {
        setClientName(client.client_name || 'Unknown');
        setUserName(client.user_name || '');
      }
      setLoading(false);
    }
    loadClient();
  }, [clientId]);

  if (loading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="h-4 w-24 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">{clientName}</span>
        {userName && (
          <>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500 text-xs">{userName}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-cyan-400" />
        <span className="text-white font-medium">{clientName}</span>
      </div>
      {userName && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-gray-400 text-sm">{userName}</span>
        </>
      )}
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <Hash size={12} className="text-gray-500" />
        <span className="text-gray-500 font-mono text-xs">{clientId}</span>
      </div>
    </div>
  );
}
