/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { Zap, Sparkles } from 'lucide-react';

interface MargTokenProps {
  onTap: () => void;
  size?: number;
}

export default function MargToken({ onTap, size = 180 }: MargTokenProps) {
  const [clickCoordinates, setClickCoordinates] = useState<{ id: number; x: number; y: number; amount: number }[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onTap();
    
    // Create floating points text around tapping point
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    
    setClickCoordinates(prev => [...prev, { id, x, y, amount: 1 }]);
    
    // Clear floating coordinate shortly after
    setTimeout(() => {
      setClickCoordinates(prev => prev.filter(c => c.id !== id));
    }, 1500);
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 1. Volumetric Light / Inner Glow behind the token */}
      <div 
        className="absolute rounded-full transition-all duration-700 bg-[radial-gradient(circle,rgba(168,85,247,0.4)_0%,transparent_70%)] blur-2xl"
        style={{
          width: `${size * 1.5}px`,
          height: `${size * 1.5}px`,
          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
          opacity: isHovered ? 0.9 : 0.7,
        }}
      />

      {/* 2. Main Floating Interactive Container */}
      <motion.div
        className="relative cursor-pointer select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        animate={{
          y: isHovered ? [-4, 4, -4] : [-8, 8, -8],
          rotate: isHovered ? [-0.5, 0.5, -0.5] : [0, 0],
        }}
        transition={{
          y: {
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut"
          },
          rotate: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }
        }}
        whileTap={{ scale: 0.94 }}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Neon outer lightning spinning borders */}
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-electric-purple/30 glow-border"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />

        {/* Ambient Lightning Sparks Layer */}
        <div className="absolute inset-0 animate-lightning flex items-center justify-center pointer-events-none opacity-40">
          <Zap className="absolute text-violet-300 w-full h-full p-6 stroke-[0.3]" />
        </div>

        {/* Main Vector Inverted MARG Symbol Triangle */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.85)] filter"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Core Purple Gradients */}
              <linearGradient id="margGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fafafa" />
                <stop offset="25%" stopColor="#d8b4fe" />
                <stop offset="70%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#581c87" />
              </linearGradient>

              {/* Inner Glow Filters */}
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Inverted Triangle Frame (Mirror of TON's Crystal Shape) */}
            {/* Outlining ▽ shape containing a divider */}
            <g filter="url(#neonGlow)">
              {/* Outer Glowing Border Path */}
              <path
                d="M 12,22 L 88,22 L 50,88 Z"
                fill="none"
                stroke="url(#margGradient)"
                strokeWidth="5"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Central Divider Bar (Mirror Theme: Inverted splits) */}
              <path
                d="M 50,22 L 50,88"
                stroke="url(#margGradient)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeDasharray="none"
              />

              {/* Inner Facets for 3D Cyber Crystal Look */}
              <polygon
                points="16,25 45,25 45,80"
                fill="rgba(168, 85, 247, 0.2)"
                stroke="rgba(192, 132, 252, 0.3)"
                strokeWidth="1.5"
              />
              <polygon
                points="84,25 55,25 55,80"
                fill="rgba(139, 92, 246, 0.25)"
                stroke="rgba(192, 132, 252, 0.3)"
                strokeWidth="1.5"
              />

              {/* Floating Node Orbs */}
              <circle cx="12" cy="22" r="3" fill="#ffffff" className="animate-pulse" />
              <circle cx="88" cy="22" r="3" fill="#ffffff" className="animate-pulse" />
              <circle cx="50" cy="88" r="3.5" fill="#f0abfc" className="shadow-[0_0_10px_#f0abfc]" />
            </g>
          </svg>
        </div>
      </motion.div>

      {/* Tap-to-mine Click Particle Floating Numbers */}
      <AnimatePresence>
        {clickCoordinates.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 1, y: c.y - 10, scale: 0.8 }}
            animate={{ opacity: 0, y: c.y - 80, scale: 1.4, x: c.x + (Math.random() * 40 - 20) }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="absolute font-display font-black text-xl text-white select-none pointer-events-none drop-shadow-[0_2px_8px_rgba(168,85,247,0.9)] flex items-center gap-1 z-30"
            style={{ left: c.x, top: c.y }}
          >
            <Sparkles className="w-4 h-4 text-electric-purple animate-ping" />
            <span>+{c.amount}</span>
            <span className="text-xs text-plasma-glow">vMARG</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <span className="text-xs font-mono tracking-widest text-indigo-300 mt-2 opacity-80 uppercase flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-electric-purple animate-spin" /> Tap to earn vMARG
      </span>
    </div>
  );
}
