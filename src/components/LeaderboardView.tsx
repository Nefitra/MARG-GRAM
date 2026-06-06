/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Award, Crown, User, ShieldAlert, Zap, Flame } from 'lucide-react';
import { LeaderboardEntry } from '../types';

interface LeaderboardViewProps {
  userBalance: number;
}

export default function LeaderboardView({ userBalance }: LeaderboardViewProps) {
  const [activeLeaderboard, setActiveLeaderboard] = useState<'holders' | 'lockers' | 'referrers'>('holders');
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  const currentRankings = rankings;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto">
      {/* 1. Header selection filter */}
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
          <Flame className="w-4 h-4 mb-0.5 animate-pulse" />
          Top Referrals
        </button>
      </div>

      {/* Cyber leaderboard container */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-4">
        <div className="absolute -right-24 -top-24 w-44 h-44 bg-purple-600/5 rounded-full blur-3xl" />

        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
            <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">MARG Hall of Legends</h3>
          </div>
          <span className="text-[10px] font-mono text-purple-400/80">Season 1 active</span>
        </div>

        {/* Loading state indicator */}
        {loading && (
          <div className="py-8 text-center text-xs font-mono text-white/55 animate-pulse">
            Querying distributed ledger stats...
          </div>
        )}

        {/* Empty state when 0 entries exist */}
        {!loading && currentRankings.length === 0 && (
          <div className="py-12 text-center rounded-2xl bg-black/20 border border-dashed border-white/5">
            <ShieldAlert className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-xs font-mono text-white/60">0 users registered in rankings</p>
            <p className="text-[10px] font-mono text-white/35 mt-1">Be the first to secure a legendary position!</p>
          </div>
        )}

        {/* Entries list of leaderboard */}
        {!loading && currentRankings.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {currentRankings.map((entry, index) => {
              const isPodium = entry.rank <= 3;
              const rankBadgeColor = 
                entry.rank === 1 
                  ? 'from-yellow-500 to-amber-300 shadow-[0_0_12px_#fbbf24]' 
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
                      {entry.power.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-mono text-white/50 mt-1">
                      {activeLeaderboard === 'referrers' 
                        ? `${entry.lockedAmount} invites` 
                        : `${entry.lockedAmount.toLocaleString()} locked`}
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
