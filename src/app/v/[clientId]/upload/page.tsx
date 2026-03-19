'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Database, PenTool, BarChart3, Upload,
  Info, HelpCircle, ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

export default function UploadHubPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const uploadModules = [
    {
      name: 'BidVault',
      description: 'Upload Evidence',
      detail: 'Add case studies, annual reports, KPI data, testimonials and other evidence to your library.',
      logo: '/bidvault-logo.svg',
      href: `/v/${clientId}/upload/bidvault`,
      color: 'from-purple-500/20 to-purple-600/10',
      borderColor: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-400/60',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      icon: Database,
      disabled: false
    },
    {
      name: 'BidWrite',
      description: 'Upload Tender',
      detail: 'Upload ITT documents to extract questions and generate AI-powered responses.',
      logo: '/bidwrite-logo.svg',
      href: `/v/${clientId}/upload/bidwrite`,
      color: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-400/60',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      icon: PenTool,
      disabled: false
    },
    {
      name: 'BidGate',
      description: 'Go/No-Go Analysis',
      detail: 'Upload tender documents for pre-bid analysis, readiness scoring and evidence gap assessment.',
      logo: '/bidgate-logo.svg',
      href: `/v/${clientId}/upload/bidgate`,
      color: 'from-amber-500/20 to-orange-600/10',
      borderColor: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400/60',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      icon: BarChart3,
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Geometric Icon */}
            <svg width="36" height="36" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="iconGradHub" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#f472b6"/>
                </linearGradient>
              </defs>
              <polygon points="8,4 32,20 8,36" fill="url(#iconGradHub)" opacity="0.9"/>
              <polygon points="14,8 34,20 14,32" fill="url(#iconGradHub)" opacity="0.6"/>
              <polygon points="20,12 38,20 20,28" fill="url(#iconGradHub)" opacity="0.3"/>
            </svg>
            {/* Logo Text */}
            <svg width="160" height="40" viewBox="0 0 180 45" style={{filter: 'drop-shadow(0 0 15px rgba(0,212,255,0.5))'}}>
              <defs>
                <linearGradient id="logoGradHub" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#f472b6"/>
                </linearGradient>
              </defs>
              <text x="0" y="32" fontFamily="system-ui, -apple-system, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-1" fill="url(#logoGradHub)">BIDENGINE</text>
              <text x="163" y="18" fontFamily="system-ui" fontSize="10" fill="#7c3aed">™</text>
            </svg>
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
              onClick={() => router.push(`/v/${clientId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="p-4 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl w-fit mx-auto mb-4">
            <Upload className="text-cyan-400" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Centre</h1>
          <p className="text-gray-400">Choose where to upload your documents</p>
        </motion.div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {uploadModules.map((module, index) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              onClick={() => !module.disabled && router.push(module.href)}
              className={`relative group ${module.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Glow effect */}
              {!module.disabled && (
                <div className={`absolute -inset-1 bg-gradient-to-r ${module.color} rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              )}
              
              <div className={`relative bg-gradient-to-br ${module.color} border ${module.borderColor} ${!module.disabled ? module.hoverBorder : ''} rounded-2xl p-6 transition-all duration-300 ${!module.disabled ? 'group-hover:translate-y-[-4px]' : 'opacity-50'} h-full`}>
                {/* Logo */}
                <div className="flex justify-center mb-4">
                  <Image 
                    src={module.logo} 
                    alt={module.name} 
                    width={80} 
                    height={80}
                    className={`drop-shadow-lg ${module.disabled ? 'grayscale opacity-50' : ''}`}
                  />
                </div>
                
                {/* Content */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-1">{module.name}</h3>
                  <p className={`text-sm font-medium mb-3 ${module.disabled ? 'text-gray-500' : module.iconColor}`}>
                    {module.description}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {module.detail}
                  </p>
                </div>

                {/* Arrow indicator */}
                {!module.disabled && (
                  <div className="absolute bottom-4 right-4">
                    <ChevronRight className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" size={20} />
                  </div>
                )}

                {/* Coming Soon Badge */}
                {module.disabled && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400/50 bg-emerald-500/10 px-2 py-1 rounded">
                      Soon
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
