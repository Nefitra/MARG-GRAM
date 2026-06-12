/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inbox, Zap, Sparkles, Award, Star, Loader2, Play } from 'lucide-react';
import { SoundManager } from '../utils/soundManager';

interface MysteryBoxViewProps {
  boxesOwned: number;
  onOpenBox: (rewardAmount: number, isSpecial: boolean, specialType?: string) => void;
  onBuyBoxes: (count: number, cost: number) => void;
  userBalance: number;
}

const REWARDS_POOL = [
  { text: '+250 vMARG Points', val: 250, special: false, rarity: 'Common' },
  { text: '+500 vMARG Points', val: 500, special: false, rarity: 'Rare' },
  { text: '+1,200 vMARG Points', val: 1200, special: false, rarity: 'Epic' },
  { text: 'PLASMA MULTIPLIER (+0.4x Multiplier)', val: 200, special: true, type: 'multiplier', rarity: 'Legendary' },
  { text: 'HOLOGRAPHIC CHIP (+1,500 Holder Power)', val: 1500, special: true, type: 'power', rarity: 'Legendary' },
];

export default function MysteryBoxView({ boxesOwned, onOpenBox, onBuyBoxes, userBalance }: MysteryBoxViewProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [rewardReveal, setRewardReveal] = useState<{ text: string, val: number, special: boolean, type?: string, rarity: string } | null>(null);
  const [purchaseProgress, setPurchaseProgress] = useState(false);

  const handleOpenContainer = () => {
    if (boxesOwned <= 0 || isOpening) {
      SoundManager.playError();
      return;
    }

    SoundManager.playTap();
    setIsOpening(true);
    setRewardReveal(null);
    SoundManager.playUnlock();

    // Alien energy cube projection sequence
    setTimeout(() => {
      // Pick random reward
      const randomIndex = Math.floor(Math.random() * REWARDS_POOL.length);
      const reward = REWARDS_POOL[randomIndex];

      setRewardReveal(reward);
      setIsOpening(false);
      onOpenBox(reward.val, reward.special, reward.type);

      if (reward.special) {
        SoundManager.playUpgrade();
      } else {
        SoundManager.playSuccess();
      }
    }, 3200);
  };

  const handleBuyContainer = () => {
    const cost = 500; // 500 MARG per loot container
    if (userBalance < cost) {
      SoundManager.playError();
      return;
    }

    SoundManager.playTap();
    setPurchaseProgress(true);
    setTimeout(() => {
      onBuyBoxes(1, cost);
      setPurchaseProgress(false);
      SoundManager.playSuccess();
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto">
      {/* 1. Alien Tech Holographic projection Container screen */}
      <div className="relative p-6 rounded-3xl bg-dark-space/75 border border-white/5 overflow-hidden flex flex-col items-center">
        {/* Gradients and background beams */}
        <div className="absolute inset-0 bg-radial-glow opacity-50" />
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent animate-pulse" />

        {/* Quantities display */}
        <div className="w-full justify-between flex items-center mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-fuchsia-950/40 border border-fuchsia-500/20 text-[#c084fc]">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-fuchsia-400 tracking-wider">QUANTUM CONTAINERS</span>
              <h3 className="text-xs font-display font-bold text-white uppercase">Alien tech inventory</h3>
            </div>
          </div>
          <span className="px-3 py-1 rounded bg-fuchsia-950/40 border border-fuchsia-500/20 font-mono text-xs text-fuchsia-400 font-bold">
            {boxesOwned} Owned
          </span>
        </div>

        {/* Dynamic Holographic alien box visualizer */}
        <div className="relative w-48 h-48 flex items-center justify-center mb-6">
          <AnimatePresence>
            {isOpening ? (
              /* Extreme spinning cyber energy projection cube */
              <motion.div
                key="spinning-cube"
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: [0.8, 1.25, 0.9], opacity: [0.5, 1, 0.9], rotate: [0, 180, 360, 720] }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 3, ease: 'easeInOut' }}
                className="absolute w-28 h-28 flex items-center justify-center"
              >
                {/* Visualizing overlapping Neon Squares */}
                <div className="absolute inset-0 border-2 border-fuchsia-500 rounded-lg animate-ping" />
                <div className="absolute inset-2 border-2 border-dashed border-violet-400 rounded-lg animate-spin" />
                <div className="absolute inset-5 bg-gradient-to-tr from-[#a855f7] to-[#e9d5ff] rounded-lg shadow-[0_0_40px_rgba(168,85,247,0.9)] animate-pulse" />
                <Zap className="w-8 h-8 text-black animate-bounce relative z-10" />
              </motion.div>
            ) : rewardReveal ? (
              /* Particle explosions with the reward crystal */
              <motion.div
                key="crystal-reveal"
                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                className="absolute flex flex-col items-center justify-center p-4 bg-fuchsia-950/30 w-44 h-44 rounded-full border border-fuchsia-500/40 shadow-[0_0_35px_rgba(244,63,94,0.3)]"
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 blur-xl opacity-60 animate-ping" />
                
                {rewardReveal.special ? (
                  <Award className="w-14 h-14 text-yellow-300 drop-shadow-[0_0_12px_#fde047] mb-2" />
                ) : (
                  <Sparkles className="w-14 h-14 text-plasma-glow drop-shadow-[0_0_12px_#e9d5ff] mb-2 animate-bounce" />
                )}

                <span className="block text-[10px] font-mono tracking-widest text-[#f472b6] uppercase font-bold animate-pulse">
                  {rewardReveal.rarity} Reward
                </span>
                <span className="block text-center text-xs text-white font-medium px-2 truncate w-full mt-1">
                  {rewardReveal.text}
                </span>
              </motion.div>
            ) : (
              /* Static floating alien tech cube container */
              <motion.div
                key="static-cube"
                className="relative cursor-pointer select-none animate-float group"
                onClick={handleOpenContainer}
                whileHover={{ scale: 1.05 }}
              >
                <div className="absolute inset-0 bg-violet-600/10 rounded-2xl filter blur-xl transition-all group-hover:bg-violet-600/30" />
                
                {/* Holographic 3D box frame using nested SVG */}
                <svg viewBox="0 0 100 100" className="w-32 h-32 drop-shadow-[0_0_18px_rgba(168,85,247,0.65)] filter">
                  <g stroke="#c084fc" strokeWidth="2" fill="none">
                    {/* Front Face */}
                    <rect x="25" y="25" width="50" height="50" rx="6" className="group-hover:stroke-white transition-colors" />
                    {/* Perspective lines */}
                    <line x1="25" y1="25" x2="10" y2="10" strokeWidth="1.5" />
                    <line x1="75" y1="25" x2="90" y2="10" strokeWidth="1.5" />
                    <line x1="25" y1="75" x2="10" y2="90" strokeWidth="1.5" />
                    <line x1="75" y1="75" x2="90" y2="90" strokeWidth="1.5" />
                    {/* Back projection frame */}
                    <rect x="10" y="10" width="80" height="80" rx="10" stroke="rgba(168, 85, 247, 0.3)" />
                  </g>
                  {/* Glowing center orb power indicator */}
                  <circle cx="50" cy="50" r="10" fill="#a855f7" className="animate-pulse shadow-[0_0_10px_#a855f7]" />
                  <circle cx="50" cy="50" r="4" fill="#fafafa" />
                </svg>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all text-center">
                  <Play className="w-10 h-10 text-white fill-current animate-ping mx-auto" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prompt description */}
        <p className="text-center text-xs text-purple-300 max-w-[280px] font-medium leading-relaxed mb-6">
          {isOpening 
            ? 'Accessing encrypted neural matrix quantum lock...' 
            : rewardReveal 
            ? 'Quantum container successfully decompiled. Claimed!' 
            : 'Tap the alien hyper-cube above to projection-open the container.'}
        </p>

        {/* Action button: Buy or Open */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleOpenContainer}
            disabled={boxesOwned <= 0 || isOpening}
            className={`w-full py-4 rounded-2xl font-display font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
              boxesOwned > 0 && !isOpening
                ? 'bg-gradient-to-r from-purple-500 via-[#8b5cf6] to-indigo-600 text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] active:scale-95'
                : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            {isOpening ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-fuchsia-400" />
                Opening Quantum Vault...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                Open Mystery Container ({boxesOwned})
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Premium shop container card */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex justify-between items-center gap-4">
        <div className="flex flex-col gap-1 text-left">
          <span className="text-[10px] font-mono text-purple-400">LIQUID EXCHANGE EXCHANGE</span>
          <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider">Acquire Mystery Containers</h4>
          <span className="text-xs text-purple-300/80 font-mono">Cost: 500 vMARG points per bundle</span>
        </div>

        <button
          onClick={handleBuyContainer}
          disabled={userBalance < 500 || purchaseProgress}
          className={`py-3 px-4 rounded-xl font-display font-black text-xs tracking-wider transition-all cursor-pointer ${
            userBalance >= 500 && !purchaseProgress
              ? 'bg-fuchsia-950/40 border border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/20 active:scale-95'
              : 'bg-white/5 border border-white/5 text-white/25 cursor-not-allowed'
          }`}
        >
          {purchaseProgress ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'BUY 1 BOX'
          )}
        </button>
      </div>

      {/* Rewards Pool Table showing potential loots */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5">
        <h4 className="text-xs font-mono text-purple-300 tracking-wider uppercase mb-3 flex items-center gap-1">
          <Star className="w-4 h-4 text-[#c084fc]" /> Container Drop Rates
        </h4>
        <div className="flex flex-col gap-2 font-mono text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-white/60">Common drop (+250 vMARG)</span>
            <span className="text-purple-400 font-bold">45.0%</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-white/60">Rare drop (+500 vMARG)</span>
            <span className="text-[#a78bfa] font-bold">30.0%</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-white/60">Epic drop (+1,200 vMARG)</span>
            <span className="text-fuchsia-400 font-bold">15.0%</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-white/60">Plasma Multiplier (+0.4x)</span>
            <span className="text-rose-400 font-bold">5.0%</span>
          </div>
          <div className="flex items-center justify-between py-1.5.5">
            <span className="text-white/60">Holographic Power (+1.5k)</span>
            <span className="text-yellow-400 font-bold">5.0%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
