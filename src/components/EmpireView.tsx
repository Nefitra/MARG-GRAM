/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Share2, Users, Trophy, UsersRound, Zap, Check, Copy } from 'lucide-react';
import { motion } from 'motion/react';

interface EmpireViewProps {
  referralCount: number;
  referralPower: number;
  referralRank: string;
  onInvite: () => void;
  inviteLink: string;
}

export default function EmpireView({ referralCount, referralPower, referralRank, onInvite, inviteLink }: EmpireViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    onInvite();
    setTimeout(() => setCopied(false), 2000);
  };

  // Dynamically generate visual nodes based on actual real referralCount
  const nodes = [{ x: 50, y: 50, label: 'YOU', level: 'center', power: 'Elite' }];
  
  const presets = [
    { x: 18, y: 25, label: 'Node L1-A', level: 'direct', power: '+1,500' },
    { x: 82, y: 25, label: 'Node L1-B', level: 'direct', power: '+1,500' },
    { x: 20, y: 75, label: 'Node L1-C', level: 'direct', power: '+1,500' },
    { x: 80, y: 75, label: 'Node L1-D', level: 'direct', power: '+1,500' },
    { x: 5, y: 15, label: 'Node L2-A', level: 'sub', power: '+500' },
    { x: 92, y: 15, label: 'Node L2-B', level: 'sub', power: '+500' },
    { x: 5, y: 90, label: 'Node L2-C', level: 'sub', power: '+500' },
    { x: 92, y: 90, label: 'Node L2-D', level: 'sub', power: '+500' },
  ];

  for (let i = 0; i < Math.min(referralCount, presets.length); i++) {
    nodes.push(presets[i]);
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto">
      {/* 1. Network-Style Connection Vector Graphic Canvas */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 bg-radial-glow opacity-50" />
        <span className="block text-[10px] font-mono text-purple-400 tracking-widest uppercase mb-1 z-10">Empire Visualization Map</span>
        <h3 className="text-sm font-display font-black text-white uppercase tracking-wider mb-5 z-10 text-center">Your Personal Cyber Empire</h3>

        {/* Dynamic Nodes Canvas */}
        <div className="relative w-full h-[220px] bg-black/40 border border-purple-500/10 rounded-2xl p-4 overflow-hidden">
          {referralCount === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-30 bg-black/30 backdrop-blur-xs">
              <UsersRound className="w-8 h-8 text-purple-400/40 mb-2 animate-pulse" />
              <p className="text-[11px] font-mono text-purple-300/70 uppercase">No connections secured yet</p>
              <p className="text-[10px] text-white/40 max-w-[220px] leading-relaxed mt-1">Populate your peer-to-peer ledger network nodes by sharing your gateway link below.</p>
            </div>
          ) : null}

          {/* Glowing connections between nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {referralCount >= 1 && <line x1="50" y1="50" x2="18" y2="25" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" className="animate-pulse" />}
            {referralCount >= 2 && <line x1="50" y1="50" x2="82" y2="25" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" />}
            {referralCount >= 3 && <line x1="50" y1="50" x2="20" y2="75" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" />}
            {referralCount >= 4 && <line x1="50" y1="50" x2="80" y2="75" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" />}

            {referralCount >= 5 && <line x1="18" y1="25" x2="5" y2="15" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1" />}
            {referralCount >= 6 && <line x1="82" y1="25" x2="92" y2="15" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1" />}
            {referralCount >= 7 && <line x1="20" y1="75" x2="5" y2="90" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1" />}
            {referralCount >= 8 && <line x1="80" y1="75" x2="92" y2="90" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1" />}
          </svg>

          {/* Renders Interactive Nodes */}
          {nodes.map((node, i) => (
            <motion.div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              whileHover={{ scale: 1.15 }}
            >
              {node.level === 'center' ? (
                /* Glowing Core User Badge */
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-[#c084fc] flex items-center justify-center border-2 border-white shadow-[0_0_15px_#a855f7] relative">
                  <span className="text-[10px] font-display font-black text-black">YOU</span>
                </div>
              ) : node.level === 'direct' ? (
                /* Direct Connection */
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-slate-900 border border-purple-500/70 flex items-center justify-center shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[8px] font-mono text-white/90 bg-black/50 px-1 py-0.2 rounded border border-white/5 mt-1 font-bold">
                    {node.label}
                  </span>
                </div>
              ) : (
                /* Secondary branch node point */
                <div className="w-3 h-3 rounded-full bg-purple-900/60 border border-purple-500/35" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* 2. Referral Stats Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden">
          <span className="text-[10px] font-mono text-purple-400 block uppercase mb-1">Total Sub-Nodes</span>
          <span className="text-2xl font-display font-black text-white">{referralCount} Connections</span>
          <span className="text-[10px] text-purple-300/70 font-mono mt-1 block">Accumulated directly</span>
        </div>

        <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden">
          <span className="text-[10px] font-mono text-purple-400 block uppercase mb-1">Ecosystem Power Yield</span>
          <span className="text-2xl font-display font-black text-[#c084fc] flex items-center gap-1">
            <Zap className="w-4 h-4" />
            +{referralPower.toLocaleString()}
          </span>
          <span className="text-[10px] text-purple-300/70 font-mono mt-1 block">Rank: {referralRank}</span>
        </div>
      </div>

      {/* 3. Sharing Node link Generator */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 flex flex-col gap-4">
        <div>
          <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider mb-1">Expand Network Gateway</h4>
          <span className="text-xs text-purple-300/80 leading-relaxed font-mono">
            Receive +1,000 Holder Power directly and +5% equivalent lock yield on every connection you secure.
          </span>
        </div>

        <div className="flex gap-2 bg-black/35 p-2 rounded-2xl border border-white/5 items-center justify-between">
          <span className="text-[11px] font-mono truncate text-white/55 pl-2 select-all">{inviteLink}</span>
          <button
            onClick={handleCopy}
            className="py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-[#a855f7] hover:bg-[#8b5cf6] text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                COPIED
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                SECURE
              </>
            )}
          </button>
        </div>
      </div>

      {/* Ranks Milestones Checklist / Rewards */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5">
        <h4 className="text-xs font-mono text-purple-300 tracking-wider uppercase mb-4 flex items-center gap-1">
          <Trophy className="w-4 h-4 text-[#c084fc]" /> Empire Milestones
        </h4>

        <div className="flex flex-col gap-3">
          <div className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-white block">Starter Baron (1 Referrals)</span>
              <span className="text-[9px] text-[#c084fc]">Unlocked +1 Mystery Container</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Active ✅</span>
          </div>

          <div className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-white block">Lord Executor (5 Referrals)</span>
              <span className="text-[9px] text-purple-400">Yield multiplier +0.2x boosts</span>
            </div>
            {referralCount >= 5 ? (
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Active ✅</span>
            ) : (
              <span className="text-[10px] font-mono text-white/40 uppercase">Locked</span>
            )}
          </div>

          <div className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
            <div className="text-left font-mono">
              <span className="text-xs font-bold text-white block">Ecosystem Sovereign (10 Referrals)</span>
              <span className="text-[9px] text-purple-400">Custom elite emblem badge access</span>
            </div>
            {referralCount >= 10 ? (
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Active ✅</span>
            ) : (
              <span className="text-[10px] font-mono text-white/40 uppercase">Locked</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
