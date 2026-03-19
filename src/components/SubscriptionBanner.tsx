'use client';

import { useState } from 'react';
import { Clock, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';

interface SubscriptionBannerProps {
  status: string;
  trialEndDate?: string;
  subscriptionEndDate?: string;
  userId?: string;
}

export default function SubscriptionBanner({ status, trialEndDate, subscriptionEndDate, userId }: SubscriptionBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
    }
    setLoading(false);
  };

  // Calculate days remaining
  const getDaysRemaining = (dateStr?: string) => {
    if (!dateStr) return 0;
    const end = new Date(dateStr);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const trialDays = getDaysRemaining(trialEndDate);
  const subscriptionDays = getDaysRemaining(subscriptionEndDate);

  // Don't show banner for active subscriptions with plenty of time
  if (status === 'active' && subscriptionDays > 7) {
    return null;
  }

  // Trial banner
  if (status === 'trialing') {
    const urgency = trialDays <= 3 ? 'urgent' : trialDays <= 7 ? 'warning' : 'info';
    const colors = {
      urgent: 'from-red-500/20 to-orange-500/20 border-red-500/30',
      warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
      info: 'from-cyan-500/20 to-purple-500/20 border-cyan-500/30',
    };
    const textColors = {
      urgent: 'text-red-400',
      warning: 'text-amber-400',
      info: 'text-cyan-400',
    };

    return (
      <div className={`bg-gradient-to-r ${colors[urgency]} border-b ${colors[urgency].split(' ').pop()}`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className={textColors[urgency]} size={18} />
            <span className="text-white text-sm">
              <span className={`font-semibold ${textColors[urgency]}`}>{trialDays} days</span> remaining in your free trial
            </span>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard size={14} />}
            Add Payment Method
          </button>
        </div>
      </div>
    );
  }

  // Past due banner
  if (status === 'past_due') {
    return (
      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-b border-red-500/30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={18} />
            <span className="text-white text-sm">
              Payment failed. Please update your payment method to continue using BidEngine.
            </span>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard size={14} />}
            Update Payment
          </button>
        </div>
      </div>
    );
  }

  // Expired banner
  if (status === 'expired' || status === 'canceled') {
    return (
      <div className="bg-gradient-to-r from-gray-500/20 to-gray-600/20 border-b border-gray-500/30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-gray-400" size={18} />
            <span className="text-white text-sm">
              Your subscription has expired. Reactivate to continue using all features.
            </span>
          </div>
          <a
            href="/subscribe"
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Reactivate
          </a>
        </div>
      </div>
    );
  }

  // Active but expiring soon
  if (status === 'active' && subscriptionDays <= 7) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-400" size={18} />
            <span className="text-white text-sm">
              Your subscription renews in <span className="font-semibold text-amber-400">{subscriptionDays} days</span>
            </span>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard size={14} />}
            Manage Subscription
          </button>
        </div>
      </div>
    );
  }

  return null;
}
