/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Zap, ShieldCheck } from 'lucide-react';
import { HolderLevel } from '../types';

interface GlowSphereProps {
  power: number;
  level: HolderLevel;
}

export default function GlowSphere({ power, level }: GlowSphereProps) {
  // Determine pulse intensity / gradient brightness based on power
  const scaleMultiplier = Math.min(1.2, 0.8 + (power / 50000) * 0.4);
  const glowShadowColor = level === 'Whale' 
    ? 'rgba(233, 213, 255, 0.9)' 
    : level === 'Elite' 
    ? 'rgba(192, 132, 252, 0.8)'
    : 'rgba(168, 85, 247, 0.6)';

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-dark-space/65 border border-white/5 rounded-3xl glow-border-plasma overflow-hidden w-full max-w-[340px] mx-auto">
      {/* Dynamic ambient energy radiation background */}
      <div className="absolute inset-0 bg-radial-glow opacity-60" />

      {/* 1. Header Holder status */}
      <div className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-electric-purple/10 border border-electric-purple/20 text-electric-purple text-[11px] font-mono tracking-wider uppercase mb-5">
        <ShieldCheck className="w-3.5 h-3.5 text-plasma-glow" />
        {level} Status Unlocked
      </div>

      {/* 2. Visual Pulsing Sphere (THE CORE) */}
      <div className="relative w-44 h-44 flex items-center justify-center mb-6">
        {/* Outer Rotating Energy Field Layer */}
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-electric-purple/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          style={{ transform: `scale(${scaleMultiplier * 1.15})` }}
        />

        {/* Mid Pulsing Core Corona */}
        <motion.div
          className="absolute w-28 h-28 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
            boxShadow: `0 0 35px ${glowShadowColor}, inset 0 0 20px rgba(168, 85, 247, 0.5)`,
          }}
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.75, 1, 0.75],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Hyper-glowing Deep Core */}
        <motion.div
          className="absolute w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-white flex items-center justify-center shadow-[0_0_25px_#c084fc]"
          animate={{
            rotate: [0, 180, 360],
            scale: [0.95, 1.05, 0.95],
          }}
          style={{
            boxShadow: `0 0 30px ${glowShadowColor}`,
          }}
          transition={{
            rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
            scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          }}
        >
          <Zap className="w-8 h-8 text-black drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)] fill-current" />
        </motion.div>

        {/* Small floating orbiting charge particles */}
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_8px_#fff]"
          animate={{
            x: [0, 75, 0, -75, 0],
            y: [-75, 0, 75, 0, -75],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#f0abfc]"
          animate={{
            x: [0, -60, 0, 60, 0],
            y: [60, 0, -60, 0, 60],
          }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* 3. Numerical Power Readings */}
      <div className="relative z-10 text-center">
        <span className="block text-xs font-mono tracking-widest text-indigo-300/70 uppercase">Holder Power</span>
        <span className="block text-4xl font-display font-black text-white text-plasma-glow tracking-tight leading-none my-1">
          {power.toLocaleString()}
        </span>
        <div className="flex items-center justify-center gap-1.5 text-xs text-plasma-glow mt-1 font-mono">
          <span className="font-semibold text-white tracking-wide uppercase px-2 py-0.5 rounded bg-violet-950/50 border border-violet-500/20">
            {level} Holder
          </span>
        </div>
      </div>
    </div>
  );
}
