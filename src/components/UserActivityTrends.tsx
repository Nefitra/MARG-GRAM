/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Zap, Sparkles, Award } from 'lucide-react';

interface EarningPoint {
  date: string;
  amount: number;
}

interface UserActivityTrendsProps {
  earningHistory?: EarningPoint[];
}

export default function UserActivityTrends({ earningHistory = [] }: UserActivityTrendsProps) {
  // Compute aggregates
  const totalEarned = earningHistory.reduce((sum, item) => sum + item.amount, 0);
  const averageEarned = earningHistory.length > 0 
    ? Math.round(totalEarned / earningHistory.length) 
    : 0;

  // Max value for scale adjustment
  const maxVal = Math.max(...earningHistory.map(item => item.amount), 500);

  // Custom Tooltip component to match the dark space/cyber-punk aesthetic
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-slate-950/95 border border-purple-500/35 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.25)] backdrop-blur-md">
          <p className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-1">
            {payload[0].payload.date}
          </p>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-xs font-mono font-black text-white">
              +{payload[0].value.toLocaleString()} vMARG
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-4 text-left">
      <div className="absolute -right-12 -top-12 w-28 h-28 bg-[#a855f7]/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header section with icon and title */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#c084fc]" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">User Activity Trends</h4>
            <span className="text-[10px] text-purple-300 font-mono block">vMARG Daily Fluidics History</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] bg-emerald-990/40 border border-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
          <span>7D Trace</span>
        </div>
      </div>

      {/* Grid of Micro-Stat Cards */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="p-3 bg-purple-950/10 border border-purple-500/10 rounded-xl relative overflow-hidden">
          <span className="text-[9px] font-mono text-purple-400/80 block uppercase tracking-wider">7D TOTAL EARNED</span>
          <span className="text-sm font-display font-black text-white mt-0.5 block">
            {totalEarned.toLocaleString()} <span className="text-[10px] font-mono font-normal text-purple-300">vMARG</span>
          </span>
        </div>

        <div className="p-3 bg-purple-950/10 border border-purple-500/10 rounded-xl relative overflow-hidden">
          <span className="text-[9px] font-mono text-purple-400/80 block uppercase tracking-wider">DAILY AVERAGE</span>
          <span className="text-sm font-display font-black text-[#c084fc] mt-0.5 block flex items-center gap-1">
            {averageEarned.toLocaleString()} <span className="text-[10px] font-mono font-normal text-purple-300">vMARG/d</span>
          </span>
        </div>
      </div>

      {/* Interactive Chart Visualizer Stage */}
      <div className="h-44 w-full mt-2 relative select-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={earningHistory}
            margin={{ top: 10, right: 5, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorEarning" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.45}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="4 4" 
              vertical={false} 
              stroke="rgba(255, 255, 255, 0.05)" 
            />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255, 255, 255, 0.3)" 
              fontSize={8} 
              fontFamily="monospace"
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis 
              stroke="rgba(255, 255, 255, 0.3)" 
              fontSize={8} 
              fontFamily="monospace"
              tickLine={false}
              axisLine={false}
              dx={-2}
              domain={[0, maxVal * 1.15]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(168, 85, 247, 0.2)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#a855f7"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEarning)"
              activeDot={{ r: 4, stroke: '#a855f7', strokeWidth: 1, fill: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Decorative prompt element */}
      <div className="text-[9px] font-mono text-purple-400/40 text-center uppercase tracking-widest mt-1">
        Tap, Open Mystery Containers, and Claim Boosts to drive up activity records
      </div>
    </div>
  );
}
