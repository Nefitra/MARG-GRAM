/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Award, Crown, ShieldAlert, Zap, Flame, Gift, Check, Lock, BarChart3, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { LeaderboardEntry } from '../types';
import ConfettiCanvas, { ConfettiRef } from './ConfettiCanvas';

interface LeaderboardViewProps {
  userBalance: number;
  userPower: number;
  claimedMilestones: number[];
  onClaimMilestoneGift: (milestonePower: number, margReward: number, boxesReward: number) => void;
}

const MILESTONES = [
  { power: 1000, name: "Core Initiated Gift", margReward: 100, boxesReward: 1, desc: "Secure first-tier nodes with basic holder clearance." },
  { power: 5000, name: "Bronze General Gift", margReward: 500, boxesReward: 2, desc: "Lead defensive locks with mid-range holder power." },
  { power: 10000, name: "Silver Titan Gift", margReward: 1000, boxesReward: 3, desc: "Establish high-performance validation matrix yields." },
  { power: 25000, name: "Emerald Overlord Gift", margReward: 3000, boxesReward: 5, desc: "Unlock superior block verification booster tiers." },
  { power: 50000, name: "Golden Sovereign Gift", margReward: 7500, boxesReward: 8, desc: "Hold major network governance allocation multipliers." },
  { power: 100000, name: "Apex Cosmic Crown", margReward: 15000, boxesReward: 15, desc: "Achieve ultimate absolute consensus dominance control." },
];

export default function LeaderboardView({ 
  userBalance, 
  userPower, 
  claimedMilestones = [], 
  onClaimMilestoneGift 
}: LeaderboardViewProps) {
  const [activeLeaderboard, setActiveLeaderboard] = useState<'holders' | 'lockers' | 'referrers'>('holders');
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);

  const handleClaimWithConfetti = (power: number, margReward: number, boxesReward: number) => {
    const intensity = power >= 10000 ? 'high' : 'medium';
    confettiRef.current?.trigger(intensity);
    onClaimMilestoneGift(power, margReward, boxesReward);
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?type=${activeLeaderboard}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.rankings) {
          setRankings(data.rankings);
        }
      })
      .catch((err) => {
        console.error("Error fetching live leaderboard:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeLeaderboard]);

  // Find next milestone and calculate general progress
  const safeUserPower = typeof userPower === 'number' && !isNaN(userPower) ? userPower : 0;
  const sortedMilestones = [...MILESTONES].sort((a, b) => a.power - b.power);
  const nextMilestone = sortedMilestones.find(m => !(claimedMilestones || []).includes(m.power)) || sortedMilestones[sortedMilestones.length - 1];
  const maxPower = sortedMilestones[sortedMilestones.length - 1].power;
  const progressPercent = Math.min((safeUserPower / (nextMilestone?.power || 1000)) * 100, 100);

  // Custom tooltips to match the premium dark/cosmic aesthetic
  const ReferrerTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 bg-slate-950/95 border border-purple-500/35 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.25)] backdrop-blur-md text-left">
          <p className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-1">
            {data.rawName}
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-mono text-white flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              Power: <strong className="text-white">{data.power.toLocaleString()}</strong>
            </span>
            <span className="text-[10px] font-mono text-purple-300">
              Invites: {data.invites} active
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto pb-8 relative">
      <ConfettiCanvas ref={confettiRef} />
      {/* 1. Milestone & Gift Claiming Sector */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-4 text-left">
        <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl" />
        
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <Gift className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          <div>
            <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">Military Milestones & Gifts</h3>
            <p className="text-[10px] font-mono text-purple-300">Assemble Holder Power to Claim Premium Rations</p>
          </div>
        </div>

        {/* Current status display */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline font-mono">
            <span className="text-[10px] text-white/50 uppercase">Your Holder Power</span>
            <span className="text-xl font-display font-black text-white flex items-center gap-1">
              <Zap className="w-4 h-4 text-purple-400" />
              {safeUserPower.toLocaleString()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div className="flex justify-between text-[9px] font-mono mb-1 text-purple-300">
              <span>Next Core Level</span>
              <span>{Math.round(progressPercent)}% To {(nextMilestone?.power || 1000).toLocaleString()} Power</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-[#c084fc] shadow-[0_0_10px_#a855f7] transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Interactive Milestones Grid */}
        <div className="flex flex-col gap-3 mt-1">
          {MILESTONES.map((m) => {
            const isClaimed = claimedMilestones.includes(m.power);
            const isUnlocked = userPower >= m.power && !isClaimed;
            const isLocked = userPower < m.power;

            return (
              <div 
                key={m.power}
                className={`p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex items-center justify-between ${
                  isClaimed 
                    ? 'bg-black/20 border-white/5 opacity-55' 
                    : isUnlocked 
                    ? 'bg-purple-950/20 border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.15)] animate-pulse' 
                    : 'bg-black/45 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 max-w-[70%]">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-all ${
                    isClaimed 
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-500' 
                      : isUnlocked 
                      ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_#a855f7]' 
                      : 'bg-slate-900 border-white/5 text-purple-400'
                  }`}>
                    {isClaimed ? (
                      <Check className="w-4 h-4" />
                    ) : isLocked ? (
                      <Lock className="w-4 h-4 text-white/30" />
                    ) : (
                      <Gift className="w-4 h-4" />
                    )}
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs font-bold text-white block truncate">{m.name}</span>
                    <span className="text-[9px] text-[#c084fc] block mt-0.5">
                      +{m.margReward.toLocaleString()} vMARG & +{m.boxesReward} Containers
                    </span>
                    <span className="text-[8.5px] text-white/40 block leading-tight mt-1 line-clamp-1">
                      {m.desc}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {isClaimed ? (
                    <span className="text-[9.5px] font-mono text-emerald-400 font-semibold uppercase bg-emerald-950/40 border border-emerald-900 px-2 py-1 rounded-lg">
                      CLAIMED
                    </span>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleClaimWithConfetti(m.power, m.margReward, m.boxesReward)}
                      className="py-1.5 px-3 rounded-lg font-display font-black text-[10px] uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                    >
                      CLAIM
                    </button>
                  ) : (
                    <span className="text-[9.5px] font-mono text-white/30 font-semibold uppercase bg-slate-950 border border-white/5 px-2 py-1 rounded-lg">
                      {userPower.toLocaleString()}/{m.power.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Header selection filter */}
      <div className="p-1 rounded-2xl bg-dark-space/75 border border-white/5 flex gap-1">
        <button
          onClick={() => setActiveLeaderboard('holders')}
          className={`flex-1 py-3 px-1 rounded-xl text-xs font-mono tracking-wider uppercase cursor-pointer transition-all flex flex-col items-center justify-center ${
            activeLeaderboard === 'holders'
              ? 'bg-[#a855f7] border border-purple-400 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4 mb-0.5" />
          Top Holders
        </button>

        <button
          onClick={() => setActiveLeaderboard('lockers')}
          className={`flex-1 py-3 px-1 rounded-xl text-xs font-mono tracking-wider uppercase cursor-pointer transition-all flex flex-col items-center justify-center ${
            activeLeaderboard === 'lockers'
              ? 'bg-[#a855f7] border border-purple-400 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4 mb-0.5" />
          Top Lockers
        </button>

        <button
          onClick={() => setActiveLeaderboard('referrers')}
          className={`flex-1 py-3 px-1 rounded-xl text-xs font-mono tracking-wider uppercase cursor-pointer transition-all flex flex-col items-center justify-center ${
            activeLeaderboard === 'referrers'
              ? 'bg-[#a855f7] border border-purple-400 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 mb-0.5" />
          Top Referrals
        </button>
      </div>

      {/* Cyber leaderboard container */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-4 text-left">
        <div className="absolute -right-24 -top-24 w-44 h-44 bg-purple-600/5 rounded-full blur-3xl" />

        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
            <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">MARG Hall of Legends</h3>
          </div>
          <span className="text-[10px] font-mono text-purple-400/80">Season 1 Active</span>
        </div>

        {/* Top Referrers Bar Chart Section */}
        {!loading && activeLeaderboard === 'referrers' && rankings.length > 0 && (
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-3 mt-1 relative overflow-hidden">
            <div className="absolute -right-12 -bottom-12 w-24 h-24 bg-[#a855f7]/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#c084fc]" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Top 5 Referrer Power</span>
              </div>
              <span className="text-[9px] font-mono text-purple-300 bg-purple-950/40 border border-purple-500/15 px-2 py-0.5 rounded-md">
                Visualization
              </span>
            </div>

            <div className="h-44 w-full mt-2 relative select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankings.slice(0, 5).map(r => ({
                    name: r.userName.replace(/^@/, ''),
                    power: r.power,
                    invites: r.lockedAmount,
                    rawName: r.userName,
                    isCurrentUser: r.isCurrentUser
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 35, left: -15, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="referrerBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#c084fc" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="referrerBarGradActive" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#db2777" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f472b6" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="rgba(255, 255, 255, 0.4)" 
                    fontSize={10} 
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip content={<ReferrerTooltip />} cursor={{ fill: 'rgba(168, 85, 247, 0.05)' }} />
                  <Bar dataKey="power" fill="url(#referrerBarGrad)" radius={[0, 4, 4, 0]} barSize={14}>
                    {rankings.slice(0, 5).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isCurrentUser ? "url(#referrerBarGradActive)" : "url(#referrerBarGrad)"}
                      />
                    ))}
                    <LabelList 
                      dataKey="power" 
                      position="right" 
                      formatter={(val: number) => val.toLocaleString()}
                      style={{ fill: 'rgba(255, 255, 255, 0.8)', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }} 
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Loading state indicator */}
        {loading && (
          <div className="py-8 text-center text-xs font-mono text-white/55 animate-pulse">
            Querying distributed ledger stats...
          </div>
        )}

        {/* Empty state when 0 entries exist */}
        {!loading && rankings.length === 0 && (
          <div className="py-12 text-center rounded-2xl bg-black/20 border border-dashed border-white/5">
            <ShieldAlert className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-xs font-mono text-white/60">0 users registered in rankings</p>
            <p className="text-[10px] font-mono text-white/35 mt-1">Be the first to secure a legendary position!</p>
          </div>
        )}

        {/* Entries list of leaderboard */}
        {!loading && rankings.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {rankings.map((entry, index) => {
              const isPodium = entry.rank <= 3;
              const rankBadgeColor = 
                entry.rank === 1 
                  ? 'from-yellow-400 to-amber-300 shadow-[0_0_12px_#fbbf24]' 
                  : entry.rank === 2 
                  ? 'from-slate-300 to-zinc-400 shadow-[0_0_12px_#cbd5e1]'
                  : entry.rank === 3 
                  ? 'from-amber-700 to-orange-500 shadow-[0_0_12px_#b45309]'
                  : 'from-violet-950 to-indigo-950';

              return (
                <div 
                  key={index}
                  className={`p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                    entry.isCurrentUser
                      ? 'bg-purple-950/30 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                      : 'bg-black/45 hover:bg-black/60 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Glowing rank medal circles */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${rankBadgeColor} flex items-center justify-center text-xs font-display font-black text-black`}>
                      {entry.rank}
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        {entry.userName}
                        {entry.isCurrentUser && (
                          <span className="text-[9px] text-[#c084fc] bg-purple-950 border border-purple-900 px-1 py-0.2 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </span>
                      <span className="block text-[9.5px] text-purple-400/80 mt-0.5">
                        {entry.level} Sovereign
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-display font-black text-white flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      {(entry?.power ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[9px] font-mono text-white/50 mt-1">
                      {activeLeaderboard === 'referrers' 
                        ? `${entry?.lockedAmount ?? 0} Invites` 
                        : `${(entry?.lockedAmount ?? 0).toLocaleString()} Locked`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
