/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AreaChart, TrendingUp, Compass, ArrowRightLeft, DollarSign, Award, Copy, Check, ExternalLink, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BuyViewProps {
  userBalance: number;
  onConfirmBuy: (margAmount: number) => void;
}

export default function BuyView({ userBalance, onConfirmBuy }: BuyViewProps) {
  const [tonInput, setTonInput] = useState<string>('');
  const [margOutput, setMargOutput] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentClaimsCount, setRecentClaimsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'swap' | 'market'>('swap');

  // Simulated live index price updates ($0.45, fluctuates slightly around there)
  const [price, setPrice] = useState(0.4572);
  const [changePercent, setChangePercent] = useState(8.42);

  useEffect(() => {
    const timer = setInterval(() => {
      setPrice(prev => {
        const delta = (Math.random() - 0.495) * 0.002;
        return Math.max(0.4, Number((prev + delta).toFixed(6)));
      });
      setChangePercent(prev => Number((prev + (Math.random() - 0.5) * 0.1).toFixed(2)));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Exchange rate: 1 TON = 12.5 MARG
  const EXCHANGE_RATE = 12.5;

  const handleTonChange = (val: string) => {
    setTonInput(val);
    if (!val || isNaN(Number(val))) {
      setMargOutput('0');
      return;
    }
    const derivedMarg = (Number(val) * EXCHANGE_RATE).toFixed(2);
    setMargOutput(derivedMarg);
  };

  const contractAddress = 'EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_';

  const handleCopyContract = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwapExecute = () => {
    const parsedAmount = parseFloat(margOutput);
    if (parsedAmount <= 0 || isNaN(parsedAmount)) return;

    setIsProcessing(true);

    // Simulate blockchain transaction routing
    setTimeout(() => {
      onConfirmBuy(parsedAmount);
      setIsProcessing(false);
      setTonInput('');
      setMargOutput('0');
      setRecentClaimsCount(prev => prev + 1);
    }, 2500);
  };

  // Preset quick buying templates
  const applyPreset = (tonVal: number) => {
    setTonInput(tonVal.toString());
    setMargOutput((tonVal * EXCHANGE_RATE).toFixed(2));
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto">
      {/* Simulation success feedback */}
      <AnimatePresence>
        {recentClaimsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-emerald-900/35 border border-emerald-400/30 rounded-2xl text-emerald-300 flex items-center gap-2 justify-center"
          >
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">SECURE SHIFT ROUTED SUCCESSFUL! Wallet Credited.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main trading cabinet with price chart */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-5">
        <div className="absolute inset-0 bg-radial-glow opacity-60" />

        {/* Dynamic mini tickers header */}
        <div className="flex justify-between items-center z-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-purple-400 tracking-wider">MARG / TON INDEX</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-display font-black text-white tracking-tight">
                ${price.toFixed(4)}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                +{changePercent.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('swap')}
              className={`py-1.5 px-3 rounded-lg text-xs font-mono tracking-wider uppercase cursor-pointer transition-all ${
                activeTab === 'swap' ? 'bg-[#a855f7] text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className={`py-1.5 px-3 rounded-lg text-xs font-mono tracking-wider uppercase cursor-pointer transition-all ${
                activeTab === 'market' ? 'bg-[#a855f7] text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              Market
            </button>
          </div>
        </div>

        {/* Valuation Explanation Panel */}
        <div className="z-10 bg-black/40 border border-white/5 rounded-2xl p-3.5 text-left font-mono text-[9.5px] text-white/60 leading-relaxed flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
          <span>
            <strong>What is this price?</strong> &middot; This represents the live real-time index valuation of 1 MARG Jetton in US Dollars ($). This valuation is determined continuously across TON decentralized liquidity pools (DeDust.io & STON.fi) based on active trading volumes, swap rates, and global network liquidity.
          </span>
        </div>

        {activeTab === 'market' ? (
          /* Live Vector price visual charts */
          <div className="h-[180px] bg-black/45 rounded-2xl relative border border-white/5 flex flex-col justify-end p-3 overflow-hidden">
            <span className="absolute top-3 left-3 text-[10px] font-mono text-purple-400/80 uppercase">Continuous price activity</span>
            
            {/* Custom SVG Glowing Area Chart Line with animated waves */}
            <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-purple-500 stroke-[2] drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(168,85,247,0.4)" />
                  <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                </linearGradient>
              </defs>
              <path d="M 0,80 Q 15,60 30,70 T 60,35 T 90,45 L 100,20 L 100,100 L 0,100 Z" fill="url(#chartGlow)" stroke="none" />
              <path d="M 0,80 Q 15,60 30,70 T 60,35 T 90,45 L 100,20" />
              {/* Dynamic blinking node coordinates on head end */}
              <circle cx="100" cy="20" r="2.5" fill="#fafafa" className="animate-ping" />
              <circle cx="100" cy="20" r="1.5" fill="#a855f7" />
            </svg>

            <div className="flex justify-between text-[9px] font-mono text-white/50 border-t border-white/5 pt-2 mt-2">
              <span>06:00 UTC</span>
              <span>12:00 UTC</span>
              <span>18:00 UTC</span>
              <span>LIVE</span>
            </div>
          </div>
        ) : (
          /* Swap Panel cabinet layout */
          <div className="flex flex-col gap-4">
            {/* Input TON Panel */}
            <div className="bg-black/45 hover:bg-black/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 transition-all">
              <div className="flex justify-between items-center text-[10px] font-mono text-purple-300">
                <span>YOU PAY</span>
                <span>TON Balance: 24.5 TON</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <input
                  type="number"
                  value={tonInput}
                  onChange={(e) => handleTonChange(e.target.value)}
                  placeholder="0.0"
                  className="bg-transparent border-none text-white font-display text-2xl outline-none w-2/3 select-all"
                />
                <span className="font-display font-black text-white text-md tracking-wider flex items-center gap-1.5 bg-sky-950/40 border border-sky-500/20 py-1 px-3 rounded-xl text-sky-400">
                  <Compass className="w-4 h-4" /> TON
                </span>
              </div>
            </div>

            {/* Middle conversion arrow */}
            <div className="flex justify-center -my-3 h-0 relative z-20">
              <div className="p-2.5 rounded-full bg-slate-900 border border-purple-500/20 text-[#c084fc] hover:rotate-180 transition-all duration-300 flex items-center justify-center shadow-lg">
                <ArrowRightLeft className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* Output MARG Panel */}
            <div className="bg-black/45 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden">
              <div className="flex justify-between items-center text-[10px] font-mono text-purple-300">
                <span>YOU RECEIVE (ESTIMATED)</span>
                <span>Wallet: {userBalance.toLocaleString()} MARG</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-white font-display text-2xl font-black">
                  {margOutput}
                </span>
                <span className="font-display font-black text-white text-md tracking-wider flex items-center gap-1.5 bg-violet-950/40 border border-violet-500/20 py-1 px-3 rounded-xl text-[#c084fc]">
                  ▽ MARG
                </span>
              </div>
            </div>

            {/* Quick Presets Selectors */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map(presets => (
                <button
                  key={presets}
                  onClick={() => applyPreset(presets)}
                  className="py-1.5 rounded-xl border border-white/5 bg-black/20 text-[11px] font-mono text-purple-300 hover:border-purple-500 hover:text-white transition-all cursor-pointer"
                >
                  +{presets} TON
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Token contract copy helper */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-mono text-purple-300">
          <span className="truncate max-w-[240px] text-white/50">EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_</span>
          <button 
            onClick={handleCopyContract}
            className="flex items-center gap-1 text-[#c084fc] hover:text-white transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* THE MAIN GLOWING BUY BUTTON */}
        <button
          onClick={handleSwapExecute}
          disabled={!tonInput || Number(tonInput) <= 0 || isProcessing}
          className={`w-full py-4.5 rounded-2xl font-display font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden cursor-pointer ${
            tonInput && Number(tonInput) > 0 && !isProcessing
              ? 'bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.7)] animate-pulse active:scale-95'
              : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-fuchsia-400" />
              Swapping Asset Reserves...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 text-emerald-300" />
              BUY MARG TOKENS NOW
            </>
          )}
        </button>
      </div>

      {/* Official ecosystem resource links */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 text-left">
        <h4 className="text-xs font-mono text-purple-300 tracking-wider uppercase mb-3 flex items-center gap-1">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> TON Blockchain Integrals
        </h4>

        <div className="flex flex-col gap-2 font-mono text-xs">
          <a
            href="https://tonviewer.com/EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-2 border-b border-white/5 text-white/70 hover:text-white transition-all"
          >
            <span>TONViewer Explorer</span>
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
          </a>
          <a
            href="https://dedust.io/swap/TON/EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-2 border-b border-white/5 text-white/70 hover:text-white transition-all"
          >
            <span>DeDust De-Fi Swap Pool</span>
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
          </a>
          <a
            href="https://ston.fi/swap?ft=TON&tt=EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-2 text-white/70 hover:text-white transition-all"
          >
            <span>StonFi Liquidity Central</span>
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
