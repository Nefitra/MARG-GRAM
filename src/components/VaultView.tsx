/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Lock, Zap, Clock, Key, Award, AlertCircle, Wallet } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { LockedPosition } from '../types';

interface VaultViewProps {
  balance: number;
  locks: LockedPosition[];
  onLock: (amount: number, durationMonths: number) => void;
}

export default function VaultView({ balance, locks, onLock }: VaultViewProps) {
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [amount, setAmount] = useState<number>(0);
  const [duration, setDuration] = useState<number>(6); // Default 6 months
  const [lockingActive, setLockingActive] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Wallet Connection check fallback UI
  if (!tonAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-dark-space/75 border border-white/5 rounded-3xl w-full max-w-[480px] mx-auto min-h-[300px]">
        <div className="p-4 rounded-full bg-violet-950/40 border border-violet-500/20 text-[#c084fc] mb-4">
          <Wallet className="w-8 h-8 animate-pulse" />
        </div>
        <h3 className="text-sm font-display font-bold text-white mb-2 uppercase tracking-wide">Wallet Disconnected</h3>
        <p className="text-[12px] font-mono text-purple-300 max-w-[280px] mb-6 leading-relaxed">
          Connect your TON wallet to use Vault
        </p>
        <button
          onClick={() => tonConnectUI.openModal()}
          className="py-3 px-6 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.35)] transition-all cursor-pointer"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // 2. Verified Balance Check fallback UI
  if (balance === undefined || balance === null) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-dark-space/75 border border-white/5 rounded-3xl w-full max-w-[480px] mx-auto min-h-[300px]">
        <div className="p-4 rounded-full bg-red-950/40 border border-red-500/20 text-red-400 mb-4 animate-bounce">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-display font-bold text-white mb-2 uppercase tracking-wide">Verification Failure</h3>
        <p className="text-[12px] font-mono text-red-300 max-w-[280px] leading-relaxed">
          Unable to verify MARG balance. Please try again later.
        </p>
      </div>
    );
  }

  const safeBalance = typeof balance === 'number' && !isNaN(balance) ? balance : 0;
  const safeLocks = Array.isArray(locks) ? locks : [];

  // Duration Options and their corresponding multiplier values
  const durationPresets = [
    { months: 1, multiplier: 1.2 },
    { months: 3, multiplier: 1.8 },
    { months: 6, multiplier: 2.5 },
    { months: 12, multiplier: 4.8 },
  ];

  const activePreset = durationPresets.find(p => p.months === duration) || durationPresets[2];
  const predictedPowerIncrement = Math.round(amount * activePreset.multiplier);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAmount(isNaN(val) ? 0 : val);
    setErrorMessage('');
  };

  const handleStartLock = () => {
    if (amount <= 0) {
      setErrorMessage('Specify an amount larger than zero');
      return;
    }
    if (amount > safeBalance) {
      setErrorMessage(`Insufficient wallet balance. You have ${safeBalance.toLocaleString()} MARG`);
      return;
    }

    setLockingActive(true);
    setErrorMessage('');

    // Trigger powerful vault sealing animation for 3.5 seconds
    setTimeout(() => {
      onLock(amount, duration);
      setLockingActive(false);
      setAnimationCompleted(true);
      setAmount(0);

      setTimeout(() => {
        setAnimationCompleted(false);
      }, 3000);
    }, 3800);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[480px] mx-auto">
      {/* Sealing Vault Futuristic Screen Modal-esque animation overlay */}
      <AnimatePresence>
        {lockingActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-deep-black/95 z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            {/* Ambient lightning simulation in container */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15)_0%,transparent_100%)] animate-pulse" />
            <div className="absolute inset-x-0 h-[2px] bg-electric-purple/40 top-1/4 animate-bounce" />
            <div className="absolute inset-x-0 h-[2px] bg-electric-purple/40 bottom-1/4 animate-bounce" />

            {/* Glowing Vault Gate Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-48 h-48 rounded-full border-4 border-dashed border-electric-purple flex items-center justify-center relative shadow-[0_0_50px_rgba(168,85,247,0.7)]"
            >
              {/* Internal spinning security node */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="w-36 h-36 rounded-full border-2 border-plasma-glow flex items-center justify-center"
              >
                <Lock className="w-16 h-16 text-white text-plasma-glow animate-pulse" />
              </motion.div>

              {/* Connected node sparks */}
              <div className="absolute top-0 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#fff]" />
              <div className="absolute bottom-0 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#fff]" />
            </motion.div>

            {/* Cyberpunk Terminal logs sealing Vault */}
            <div className="mt-8 max-w-sm">
              <span className="text-xs font-mono text-purple-400 tracking-wider block uppercase mb-1">CONNECTING QUANTUM VAULT</span>
              <motion.h3 
                animate={{ opacity: [1, 0.4, 1] }} 
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-xl font-display font-semibold text-white tracking-widest"
              >
                LOCKING {amount.toLocaleString()} MARG
              </motion.h3>
              
              <div className="mt-4 font-mono text-[11px] text-white/50 space-y-1 text-left bg-black/40 p-4 rounded-xl border border-white/5 max-h-[140px] overflow-y-auto">
                <p className="text-fuchsia-400">⚡ Initializing orbital secure key lock...</p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-purple-300">⚡ Multiplying core coefficients: {activePreset.multiplier}x Power</motion.p>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="text-indigo-400">⚡ Compiling lightning energy fields around assets...</motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }} className="text-white">⚡ Vault authorization: VALIDATED ✅</motion.p>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.9 }} className="text-emerald-400 font-semibold animate-pulse">⚡ SECURE SEAL COMMITTED successfully</motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success notification alert banner */}
      <AnimatePresence>
        {animationCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-900/30 border border-emerald-500/40 text-center text-emerald-300 relative overflow-hidden"
          >
            <div className="absolute -left-12 -top-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
            <h4 className="font-display font-bold text-sm tracking-uppercase mb-1">VAULT SEALED SUCCESSFULLY</h4>
            <p className="text-xs opacity-90 font-mono">Your assets are lock-secured. Holder Power multipliers applied.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Lock Interactive Dashboard Form */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col gap-5">
        <div className="absolute -left-16 -top-16 w-32 h-32 rounded-full bg-violet-600/5 blur-3xl" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-950/40 border border-violet-500/20 text-[#c084fc]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-xs font-mono text-purple-400 tracking-wider uppercase">FUTURISTIC LOCKING GAUGE</span>
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">Secure Token Vault</h3>
            </div>
          </div>
          <Lock className="w-5 h-5 text-purple-400/50" />
        </div>

        {/* Input Amount controls */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono text-purple-300">
            <span>LOCK QUANTITY</span>
            <span 
              onClick={() => setAmount(safeBalance)}
              className="cursor-pointer hover:text-white transition-colors underline"
            >
              Max: {safeBalance.toLocaleString()} MARG
            </span>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAmount(isNaN(val) ? 0 : val);
                }}
                className="w-full bg-transparent border-none text-white font-display text-2xl outline-none select-all"
                placeholder="0.0"
              />
              <span className="font-display font-bold text-purple-400 text-sm">MARG</span>
            </div>

            {/* Range Slider for immediate amount tweaking */}
            <input
              type="range"
              min="0"
              max={safeBalance}
              step={Math.ceil(safeBalance / 50 || 1)}
              value={amount}
              onChange={handleSliderChange}
              className="w-full accent-[#c084fc] bg-violet-950/20 cursor-pointer h-1.5 rounded-lg border-none"
            />
          </div>
        </div>

        {/* Lock Duration Presets */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono text-purple-300">LOCK DURATION & POWER COEFFICIENT</span>
          <div className="grid grid-cols-4 gap-2.5">
            {durationPresets.map((preset) => (
              <button
                key={preset.months}
                onClick={() => setDuration(preset.months)}
                className={`py-2 px-1 text-center rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  duration === preset.months
                    ? 'border-purple-500 bg-purple-950/40 text-white shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                    : 'border-white/5 bg-black/20 text-white/60 hover:border-white/10 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 mb-1 opacity-70" />
                <span className="text-[12px] font-display font-bold">{preset.months} MO</span>
                <span className="text-[10px] font-mono text-purple-400 mt-0.5">{preset.multiplier}x</span>
              </button>
            ))}
          </div>
        </div>

        {/* Multiplier Yield Predictor Display */}
        <div className="bg-gradient-to-br from-violet-950/35 to-fuchsia-950/15 border border-violet-500/15 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-indigo-300 uppercase flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Power Multiplier Status
            </span>
            <span className="text-[20px] font-display font-black text-white mt-1">
              +{predictedPowerIncrement.toLocaleString()} POWER
            </span>
          </div>
          <div className="text-right">
            <span className="block text-xs font-mono text-purple-400">COEFFICIENT</span>
            <span className="block font-display font-black text-white text-xl">{activePreset.multiplier}x</span>
          </div>
        </div>

        {errorMessage && (
          <div className="text-xs font-mono text-red-400 bg-red-950/30 border border-red-900/40 p-3 rounded-xl flex items-center gap-1.5 justify-center">
            <AlertCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        {/* Massive Commit Action Button */}
        <button
          onClick={handleStartLock}
          disabled={amount <= 0}
          className={`w-full py-4 rounded-2xl font-display font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
            amount > 0
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] active:scale-[0.98]'
              : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          <Zap className={`w-4 h-4 ${amount > 0 ? 'text-yellow-400 animate-pulse' : ''}`} />
          SEAL VAULT & LOCK MARG
        </button>
      </div>

      {/* Historic locks List */}
      <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5">
        <h4 className="text-xs font-mono text-purple-300 tracking-wider uppercase mb-4 flex items-center gap-1.5">
          <Key className="w-4 h-4" /> Locked Vault Securities ({safeLocks.length})
        </h4>

        {safeLocks.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl text-xs text-white/40 font-mono">
            No secure assets currently locked inside the vault.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {safeLocks.map((lock, index) => {
              const lockAmount = typeof lock?.amount === 'number' ? lock.amount : 0;
              const multiplier = typeof lock?.multiplier === 'number' ? lock.multiplier : 1;
              const powerYield = typeof lock?.powerYield === 'number' ? lock.powerYield : Math.round(lockAmount * multiplier);
              let unlockDateStr = "Locked";
              try {
                if (lock?.unlockDate) {
                  const dateObj = new Date(lock.unlockDate);
                  if (!isNaN(dateObj.getTime())) {
                    unlockDateStr = dateObj.toLocaleDateString();
                  }
                }
              } catch (e) {
                // Ignore parsing errors and keep default
              }
              return (
                <div 
                  key={index}
                  className="p-3.5 rounded-2xl bg-black/45 hover:bg-black/60 border border-white/5 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-950/40 text-purple-400 border border-purple-900/40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-semibold text-white">{lockAmount.toLocaleString()} MARG</span>
                      <span className="block text-[10px] font-mono text-purple-400">Unlock: {unlockDateStr}</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-display font-black text-purple-400">+{powerYield.toLocaleString()} POWER</span>
                    <span className="text-[9px] font-mono bg-indigo-950/50 text-indigo-300 px-1.5 py-0.5 rounded uppercase mt-1">
                      {multiplier}x locked
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
