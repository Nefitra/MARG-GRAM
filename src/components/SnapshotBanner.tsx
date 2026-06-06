/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, AlertCircle, Zap, CheckCircle2, Copy, Check } from 'lucide-react';

interface SnapshotBannerProps {
  userBalance: number;
  userLocked: number;
  referralsCount: number;
}

export default function SnapshotBanner({ userBalance, userLocked, referralsCount }: SnapshotBannerProps) {
  const [timeLeft, setTimeLeft] = useState({ days: '03', hours: '12', minutes: '25', seconds: '45' });
  const [copied, setCopied] = useState(false);

  // Countdown timer logic
  useEffect(() => {
    // Arbitrary future target date 3 days out
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    targetDate.setHours(targetDate.getHours() + 12);
    targetDate.setMinutes(targetDate.getMinutes() + 25);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference <= 0) {
        clearInterval(interval);
        return;
      }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({
        days: d.toString().padStart(2, '0'),
        hours: h.toString().padStart(2, '0'),
        minutes: m.toString().padStart(2, '0'),
        seconds: s.toString().padStart(2, '0'),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const contractAddress = 'EQD-MARG-xX9mUr8z91p0To7c90b_M_G7_v6_O_N';

  const handleCopyContractAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check eligibility metrics
  const hasMinBalance = userBalance >= 1000;
  const hasLocked = userLocked > 0;
  const hasReferral = referralsCount >= 1;

  const totalChecks = [hasMinBalance, hasLocked, hasReferral].filter(Boolean).length;
  const isEligible = totalChecks === 3;

  return (
    <div className="flex flex-col gap-5 p-6 rounded-3xl bg-dark-space/75 border border-purple-500/20 backdrop-blur-xl relative overflow-hidden w-full max-w-[480px] mx-auto">
      {/* Immersive flashing emergency light bar */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse" />
      <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-violet-600/10 blur-3xl" />

      {/* Snapshot Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-violet-950/50 border border-violet-500/30 text-electric-purple animate-pulse">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <span className="block text-xs font-mono text-purple-400 tracking-wider uppercase">Active Network Snapshots</span>
          <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">MARG Phase-I Genesis Drop</h3>
        </div>
      </div>

      {/* Flashing Urgency Countdown Timer */}
      <div className="flex flex-col items-center bg-violet-950/20 py-4 px-3 rounded-2xl border border-violet-500/15">
        <span className="text-[10px] font-mono tracking-widest text-[#f5f3ff]/60 uppercase flex items-center gap-1 mb-2">
          <AlertCircle className="w-3 h-3 text-red-400 animate-ping" />
          Time till Blockchain Snapshot
        </span>

        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <span className="block text-3xl font-display font-black text-white text-plasma-glow text-neon-glow leading-none">
              {timeLeft.days}
            </span>
            <span className="block text-[9px] font-mono tracking-wider text-purple-400/80 uppercase mt-1">Days</span>
          </div>
          <div className="border-l border-purple-900/40">
            <span className="block text-3xl font-display font-black text-white text-plasma-glow text-neon-glow leading-none">
              {timeLeft.hours}
            </span>
            <span className="block text-[9px] font-mono tracking-wider text-purple-400/80 uppercase mt-1">Hours</span>
          </div>
          <div className="border-l border-purple-900/40">
            <span className="block text-3xl font-display font-black text-white text-plasma-glow text-neon-glow leading-none">
              {timeLeft.minutes}
            </span>
            <span className="block text-[9px] font-mono tracking-wider text-purple-400/80 uppercase mt-1">Mins</span>
          </div>
          <div className="border-l border-purple-900/40">
            <span className="block text-3xl font-display font-black text-white text-plasma-glow text-neon-glow leading-none">
              {timeLeft.seconds}
            </span>
            <span className="block text-[9px] font-mono tracking-wider text-purple-400/80 uppercase mt-1">Secs</span>
          </div>
        </div>
      </div>

      {/* Requirement Qualification Checklist */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-mono tracking-wide text-indigo-300/80 uppercase">Qualification Criteria</span>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/20">
            {totalChecks}/3 Checked
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Requirement 1 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/5">
            <div className="flex items-center gap-2.5">
              {hasMinBalance ? (
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-purple-500/30 flex items-center justify-center text-[8px] text-purple-500 font-mono" />
              )}
              <div className="text-left">
                <span className="block text-xs text-white/90 font-medium">Hold ≥ 1,000 MARG</span>
                <span className="block text-[10px] text-purple-400/70 font-mono">Your balance: {userBalance.toLocaleString()} MARG</span>
              </div>
            </div>
            {hasMinBalance && <span className="text-[10px] font-mono text-emerald-400 uppercase">Passed</span>}
          </div>

          {/* Requirement 2 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/5">
            <div className="flex items-center gap-2.5">
              {hasLocked ? (
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-purple-500/30 flex items-center justify-center text-[8px] text-purple-500 font-mono" />
              )}
              <div className="text-left">
                <span className="block text-xs text-white/90 font-medium">Activate Vault Lock</span>
                <span className="block text-[10px] text-purple-400/70 font-mono">Lock tokens in vault for multipliers</span>
              </div>
            </div>
            {hasLocked && <span className="text-[10px] font-mono text-emerald-400 uppercase">Passed</span>}
          </div>

          {/* Requirement 3 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/5">
            <div className="flex items-center gap-2.5">
              {hasReferral ? (
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-purple-500/30 flex items-center justify-center text-[8px] text-purple-500 font-mono" />
              )}
              <div className="text-left">
                <span className="block text-xs text-white/90 font-medium">Recruit 1+ Empire Node</span>
                <span className="block text-[10px] text-purple-400/70 font-mono">Invite connections under your network</span>
              </div>
            </div>
            {hasReferral && <span className="text-[10px] font-mono text-emerald-400 uppercase">Passed</span>}
          </div>
        </div>
      </div>

      {/* Contract Section */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/5 border border-white/5 text-[11px] font-mono text-purple-300">
        <span className="truncate max-w-[200px] text-white/55">TON Contract: {contractAddress}</span>
        <button 
          onClick={handleCopyContractAddress}
          className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-electric-purple/10 border border-electric-purple/30 hover:bg-electric-purple/20 text-electric-purple transition-all active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Qualification Alert Label */}
      <div className="text-center mt-1">
        {isEligible ? (
          <div className="text-xs bg-emerald-900/20 text-emerald-400 py-2 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-1.5 font-semibold">
            <Zap className="w-4 h-4 animate-bounce fill-current" />
            QUALIFIED FOR GENESIS REWARDS
          </div>
        ) : (
          <div className="text-xs bg-amber-900/20 text-amber-300 py-2 rounded-xl border border-amber-500/20 flex items-center justify-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            INCOMPLETE ELIGIBILITY STATUS
          </div>
        )}
      </div>
    </div>
  );
}
