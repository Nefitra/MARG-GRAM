/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, ShieldCheck, Lock, Unlock, Inbox, Users, Trophy, 
  Sparkles, Calendar, Compass, Wallet, CheckCircle2, Award, 
  AlertCircle, ChevronRight, Gamepad2, ArrowRightLeft, Star
} from 'lucide-react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

import BackgroundEffect from './components/BackgroundEffect';
import MargToken from './components/MargToken';
import GlowSphere from './components/GlowSphere';
import SnapshotBanner from './components/SnapshotBanner';
import VaultView from './components/VaultView';
import MysteryBoxView from './components/MysteryBoxView';
import EmpireView from './components/EmpireView';
import BuyView from './components/BuyView';
import LeaderboardView from './components/LeaderboardView';
import { UserState, HolderLevel, LockedPosition } from './types';

// Default state when nothing is in localStorage or server is loading
const DEFAULT_STATE: UserState = {
  balance: 0,
  lockedBalance: 0,
  holderPower: 0,
  level: 'Starter',
  totalRewardsClaimed: 0,
  referralCount: 0,
  referralPower: 0,
  referralRank: 'Squire',
  mysteryBoxesOwned: 0,
  openedBoxesCount: 0,
  lastClaimDate: null,
  locks: [],
  empireCreated: false,
  rank: 0,
  claimedMilestones: [],
};

const POWER_TIERS: { level: HolderLevel; minPower: number }[] = [
  { level: 'Whale', minPower: 75000 },
  { level: 'Elite', minPower: 25000 },
  { level: 'Power', minPower: 10000 },
  { level: 'Active', minPower: 2500 },
  { level: 'Starter', minPower: 0 },
];

export default function App() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();

  const apiFetch = async (url: string, options: any = {}) => {
    const initData = (window as any).TELEGRAM_INIT_DATA || localStorage.getItem('MARG_ECOSYSTEM_INIT_DATA') || "";
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
      }
    });
  };

  const [state, setState] = useState<UserState>(() => {
    const saved = localStorage.getItem('MARG_ECOSYSTEM_STATE');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return DEFAULT_STATE;
  });

  const [activeTab, setActiveTab] = useState<'home' | 'core' | 'vault' | 'loot' | 'empire' | 'trade' | 'leaderboard'>('home');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeClaimAnimation, setActiveClaimAnimation] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [tgUser, setTgUser] = useState<any>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tgError, setTgError] = useState<string | null>(null);

  // Load Telegram WebApp & Initialize User State
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        const webapp = (window as any).Telegram?.WebApp;
        let initData = webapp?.initData || "";
        
        if (!initData) {
          // Direct fallback for web browser access, bypassing Telegram blocks
          initData = "user=" + encodeURIComponent(JSON.stringify({
            id: 14201337,
            username: "DemoSovereign",
            first_name: "Demo Sovereign Member"
          })) + "&hash=mock_demo_mode_hash";
        }
        (window as any).TELEGRAM_INIT_DATA = initData;
        localStorage.setItem('MARG_ECOSYSTEM_INIT_DATA', initData);

        const response = await apiFetch('/api/user/init', {
          method: 'POST',
          body: JSON.stringify({ 
            initData, 
            walletAddress: tonAddress || "" 
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            setTgUser(resData.user);
            setIsSandbox(resData.isSandbox || false);
            const userState: UserState = {
              balance: resData.user.wallet_address ? resData.user.ton_marg_balance : resData.user.balance,
              lockedBalance: resData.stats.totalLockedAmount || 0,
              holderPower: resData.stats.holderPower || 0,
              level: resData.stats.level || 'Starter',
              totalRewardsClaimed: resData.user.total_rewards_claimed || 0,
              referralCount: (resData.user.referral_count_l1 || 0) + (resData.user.referral_count_l2 || 0),
              referralPower: (resData.user.referral_count_l1 || 0) * 1500 + (resData.user.referral_count_l2 || 0) * 500,
              referralRank: resData.user.referral_count_l1 >= 10 ? 'Sovereign' : resData.user.referral_count_l1 >= 5 ? 'Executor' : 'Squire',
              mysteryBoxesOwned: resData.user.mystery_boxes_owned ?? 3,
              openedBoxesCount: resData.user.opened_boxes_count || 0,
              lastClaimDate: resData.user.last_claim_date || null,
              locks: resData.locks || [],
              empireCreated: (resData.user.referral_count_l1 || 0) > 0,
              rank: 1420,
              claimedMilestones: resData.user.claimed_milestones || [],
            };
            setState(userState);
          }
        } else {
          // If response not ok, fall back to offline storage / defaults gracefully so the app still renders
          console.warn("Express API failed, loading standalone sandbox session.");
          setIsSandbox(true);
          setTgUser({
            id: 14201337,
            username: "DemoSovereign",
            first_name: "Demo Sovereign Member"
          });
        }
      } catch (err) {
        console.error("Failed synchronization with TON/Express API:", err);
        // Fall back to offline/sandbox session to keep app accessible
        setIsSandbox(true);
        setTgUser({
          id: 14201337,
          username: "DemoSovereign",
          first_name: "Demo Sovereign Member"
        });
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [tonAddress]);

  // Synchronize with database if wallet connection state changes
  useEffect(() => {
    if (tonAddress && tgUser) {
      apiFetch('/api/user/connect-wallet', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser.id,
          walletAddress: tonAddress
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setState(prev => ({
            ...prev,
            balance: data.user.ton_marg_balance,
            lockedBalance: data.stats.totalLockedAmount,
            holderPower: data.stats.holderPower,
            level: data.stats.level,
            locks: data.locks
          }));
        }
      })
      .catch(console.error);
    }
  }, [tonAddress, tgUser]);

  // Recalculate levels offline helper
  const getLevelForPower = (power: number): HolderLevel => {
    for (const tier of POWER_TIERS) {
      if (power >= tier.minPower) {
        return tier.level;
      }
    }
    return 'Starter';
  };

  const updatePowerAndLevel = (partialState: Partial<UserState>) => {
    setState(prev => {
      const nextBalance = partialState.balance !== undefined ? partialState.balance : prev.balance;
      const nextLocked = partialState.lockedBalance !== undefined ? partialState.lockedBalance : prev.lockedBalance;
      const nextRefPower = partialState.referralPower !== undefined ? partialState.referralPower : prev.referralPower;
      
      const activeLocksPower = prev.locks.reduce((acc, curr) => acc + (curr.powerYield || 0), 0);
      const calculatedPower = Math.round(nextBalance + activeLocksPower + nextRefPower);
      const nextLevel = getLevelForPower(calculatedPower);

      const computed = {
        ...prev,
        ...partialState,
        holderPower: calculatedPower,
        level: nextLevel,
      };
      localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(computed));
      return computed;
    });
  };

  // 1. Core tap mechanism
  const handleTapMargToken = () => {
    updatePowerAndLevel({ balance: state.balance + 1 });
  };

  // 2. Daily claim flow (server-validated cooldown check)
  const isClaimAvailable = () => {
    if (!state.lastClaimDate) return true;
    const lastClaim = new Date(state.lastClaimDate).getTime();
    const now = new Date().getTime();
    return now - lastClaim >= 24 * 60 * 60 * 1000;
  };

  const handleDailyClaim = async () => {
    if (!isClaimAvailable()) return;

    try {
      const resp = await apiFetch('/api/user/claim-daily', {
        method: 'POST',
        body: JSON.stringify({ telegramUserId: tgUser?.id || "14201337" })
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(data.error || "Cooldown active");
        return;
      }

      setClaimText(`+1,500 MARG UNLOCKED`);
      setActiveClaimAnimation(true);

      setState(prev => ({
        ...prev,
        balance: data.user.balance,
        lastClaimDate: data.user.last_claim_date,
        holderPower: data.stats.holderPower,
        level: data.stats.level,
        totalRewardsClaimed: prev.totalRewardsClaimed + 1500
      }));

      setTimeout(() => {
        setActiveClaimAnimation(false);
      }, 2800);

    } catch (err) {
      console.error(err);
    }
  };

  // 3. Locking Assets
  const handleLockPosition = async (amountLocked: number, durationMonths: number) => {
    try {
      const resp = await apiFetch('/api/user/lock', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser?.id || "14201337",
          amount: amountLocked,
          durationMonths
        })
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(data.error || "Lock commitment failed");
        return;
      }

      const formattedLocks = data.locks.map((lk: any) => ({
        amount: lk.amount,
        unlockDate: lk.unlock_date,
        durationMonths: Math.round(lk.duration_days / 30),
        multiplier: lk.multiplier,
        powerYield: Math.round(lk.amount * lk.multiplier),
        active: lk.status === 'active'
      }));

      setState(prev => ({
        ...prev,
        balance: data.user.balance,
        lockedBalance: data.user.locked_balance,
        holderPower: data.stats.holderPower,
        level: data.stats.level,
        locks: formattedLocks
      }));

    } catch (err) {
      console.error(err);
    }
  };

  // 4. Mystery Box opener
  const handleOpenMysteryBox = async (val: number, isSpecial: boolean, specialType?: string) => {
    try {
      const resp = await apiFetch('/api/user/mystery-box/open', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser?.id || "14201337",
          specialOpen: isSpecial
        })
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(data.error || "Failed opening orbital containers");
        return;
      }

      const formattedLocks = data.locks.map((lk: any) => ({
        amount: lk.amount,
        unlockDate: lk.unlock_date,
        durationMonths: Math.round(lk.duration_days / 30),
        multiplier: lk.multiplier,
        powerYield: Math.round(lk.amount * lk.multiplier),
        active: lk.status === 'active'
      }));

      setState(prev => ({
        ...prev,
        balance: data.user.balance,
        mysteryBoxesOwned: data.user.mystery_boxes_owned,
        openedBoxesCount: data.user.opened_boxes_count,
        holderPower: data.stats.holderPower,
        level: data.stats.level,
        locks: formattedLocks
      }));

      alert(`Orbital container opened! Prize Uncovered: +${data.prizeAmount.toLocaleString()} ${data.prizeType === 'balance' ? 'Liquid MARG Reserve' : 'Permanent Multiplier Power'}`);

    } catch (err) {
      console.error(err);
    }
  };

  const handleBuyBoxes = async (count: number, cost: number) => {
    try {
      const resp = await apiFetch('/api/user/mystery-box/buy', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser?.id || "14201337",
          count
        })
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(data.error || "Friction during purchase checkout");
        return;
      }

      setState(prev => ({
        ...prev,
        balance: data.user.balance,
        mysteryBoxesOwned: data.user.mystery_boxes_owned,
        holderPower: data.stats.holderPower,
        level: data.stats.level
      }));

    } catch (err) {
      console.error(err);
    }
  };

  // Invite handler (Now correct: click copies link, but referrals only increment via real ref registrations)
  const handleInvitePerson = () => {
    console.log("Referral link secured: ", referralLink);
  };

  const handleClaimMilestoneGift = async (milestonePower: number, margReward: number, boxesReward: number) => {
    // 1. Update the local state with new balance and mystery boxes
    const nextClaimed = [...(state.claimedMilestones || []), milestonePower];
    
    setState(prev => {
      const updated = {
        ...prev,
        claimedMilestones: nextClaimed,
        balance: prev.balance + margReward,
        mysteryBoxesOwned: prev.mysteryBoxesOwned + boxesReward
      };
      localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(updated));
      return updated;
    });

    // 2. Synchronize with parent stats
    updatePowerAndLevel({
      balance: state.balance + margReward,
      mysteryBoxesOwned: state.mysteryBoxesOwned + boxesReward
    });

    // 3. Post to backend-sync (rewards calculated server-side internally for maximum security)
    try {
      const resp = await apiFetch('/api/user/claim-milestone', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser?.id || "14201337",
          milestonePower
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.user) {
          // Re-sync correct state from server
          setState(prev => ({
            ...prev,
            balance: data.user.wallet_address ? data.user.ton_marg_balance : data.user.balance,
            mysteryBoxesOwned: data.user.mystery_boxes_owned,
            claimedMilestones: data.user.claimed_milestones || nextClaimed
          }));
        }
      }
    } catch (e) {
      console.error("Network sync fail for claiming milestone gift:", e);
    }
  };

  const handleConfirmBuy = (margBought: number) => {
    updatePowerAndLevel({
      balance: state.balance + margBought,
    });
  };

  const referralLink = `https://t.me/marg_ecosystem_bot/app?startapp=ref_${tgUser?.id || "14201337"}`;

  if (tgError) {
    return (
      <div className="min-h-screen relative text-slate-100 flex flex-col justify-center items-center p-6 text-center bg-radial-glow font-sans bg-grid max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <BackgroundEffect />
        <div className="w-16 h-16 bg-red-950/45 border border-red-500/35 rounded-2xl flex items-center justify-center text-red-400 mb-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-sm font-display font-black text-white uppercase tracking-wider mb-2">Secure Sovereign Portal</h2>
        <p className="text-[11px] text-white/55 font-mono leading-relaxed mb-6 max-w-[280px]">
          This gateway requires Telegram client credentials to query distributed network ledgers, verify referrals, and commit locked positions on the TON blockchain.
        </p>
        <a
          href="https://t.me/marg_ecosystem_bot"
          target="_blank"
          referrerPolicy="no-referrer"
          className="py-3 px-6 rounded-xl font-display font-black text-[11px] uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.35)] transition-all cursor-pointer"
        >
          Open @marg_ecosystem_bot
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen relative text-slate-100 flex flex-col justify-center items-center p-6 text-center bg-radial-glow font-sans bg-grid max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <BackgroundEffect />
        <div className="w-10 h-10 rounded-full border-t border-r border-[#c084fc] animate-spin mb-4" />
        <p className="text-[10px] font-mono text-purple-300 uppercase tracking-widest animate-pulse">Synchronizing Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative text-slate-100 flex flex-col pb-28 pt-4 select-none px-4 bg-radial-glow font-sans bg-grid max-w-md mx-auto border-x border-white/5 shadow-2xl">
      <BackgroundEffect />

      {/* Extreme particle reward claim pop-up overlay */}
      <AnimatePresence>
        {activeClaimAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-deep-black/90 p-6 text-center"
          >
            <div className="absolute inset-0 bg-radial-glow opacity-80 animate-pulse" />
            <motion.div 
              animate={{ rotate: [0, 18,-18, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-40 h-40 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center p-1.5 shadow-[0_0_55px_rgba(168,85,247,0.7)]"
            >
              <div className="w-full h-full bg-deep-black rounded-full flex items-center justify-center">
                <Sparkles className="w-16 h-16 text-plasma-glow animate-bounce" />
              </div>
            </motion.div>

            <h3 className="text-2xl font-display font-black text-white text-plasma-glow text-neon-glow uppercase mt-6 tracking-widest animate-pulse">
              {claimText}
            </h3>
            <p className="text-xs text-purple-300 font-mono mt-1">
              Loyalty claims credited inside your TON margin wallet reserves.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR CABINET CONTROL FRAME */}
      <header className="flex items-center justify-between w-full mb-6 relative z-30">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-950/70 border border-violet-500/30 text-neon-violet shadow-md">
            <span className="font-display font-black text-xs text-white">MR</span>
          </div>
          <div className="text-left leading-none">
            <h1 className="text-sm font-display font-black tracking-widest text-[#f5f3ff] uppercase flex items-center gap-1">
              MARG <span className="text-[10px] text-fuchsia-400 font-mono tracking-normal lowercase">v1.2</span>
              {isSandbox ? (
                <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-400 px-1.5 py-0.5 rounded font-mono font-medium tracking-normal normal-case">Sandbox</span>
              ) : (
                <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium tracking-normal normal-case">Live Sync</span>
              )}
            </h1>
            <span className="text-[9px] font-mono uppercase text-[#818cf8]">TON Ecosystem Portal</span>
          </div>
        </div>

        {/* Real TON Connection Controller */}
        <button
          onClick={() => {
            if (tonAddress) {
              tonConnectUI.disconnect();
            } else {
              tonConnectUI.openModal();
            }
          }}
          className={`py-2 px-3.5 rounded-xl font-display font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
            tonAddress
              ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'bg-violet-950/45 border-violet-500/40 text-[#c084fc] hover:bg-violet-500/20 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 animate-pulse" />
          {tonAddress ? `TON: ${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : 'Link Wallet'}
        </button>
      </header>

      {/* Dynamic Status Notice Banner */}
      {isSandbox ? (
        <div className="w-full bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-amber-400 relative z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-bold tracking-wide uppercase leading-none">Sandbox Simulation Mode</div>
              <div className="text-[9px] text-amber-400/60 font-mono leading-none mt-1">Direct web browser access. Connect TON wallet to sync live MARG balances.</div>
            </div>
          </div>
          <span className="text-[9px] bg-amber-950/40 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase text-amber-400 select-none">Active</span>
        </div>
      ) : (
        <div className="w-full bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-emerald-400 relative z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-bold tracking-wide uppercase leading-none">Secure Telegram Session</div>
              <div className="text-[9px] text-emerald-400/60 font-mono leading-none mt-1">Profile verified via HMAC signature. Direct TON network connectivity active.</div>
            </div>
          </div>
          <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase text-emerald-400 select-none">Live</span>
        </div>
      )}

      {/* GLOBAL WALLET BALANCES CABINET METRIC */}
      <section className="w-full bg-dark-space/75 rounded-3xl p-5 border border-white/5 relative overflow-hidden mb-6 z-20 shadow-lg">
        <div className="absolute -right-16 -top-16 w-32 h-32 bg-violet-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-fuchsia-600/5 rounded-full blur-3xl animate-pulse" />

        <div className="flex justify-between items-center text-[10px] font-mono text-purple-400/80 tracking-widest uppercase">
          <span>Active Token Collateral</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            TON Blockchain Node
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-4xl font-display font-black text-white text-plasma-glow text-neon-glow tracking-tighter leading-none">
            {state.balance.toLocaleString()}
          </span>
          <span className="text-xs font-mono text-purple-400 tracking-wider">MARG</span>
        </div>

        {/* Micro split: Locked vs Claims totals */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="text-left font-mono">
            <span className="text-[9px] text-white/45 uppercase tracking-wide block">Collateral Vault Locked</span>
            <span className="text-sm font-bold text-white">{state.lockedBalance.toLocaleString()} MARG</span>
          </div>
          <div className="text-left font-mono border-l border-white/5 pl-3">
            <span className="text-[9px] text-white/45 uppercase tracking-wide block">Network Rewards Claimed</span>
            <span className="text-sm font-bold text-[#c084fc]">{state.totalRewardsClaimed.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* MAIN NAVIGATION TAB LAYOUT CONTROLLERS */}
      <nav className="flex gap-1 bg-black/60 p-1.5 rounded-2xl border border-white/5 w-full overflow-x-auto scroller-hidden z-20 relative mb-6">
        {[
          { id: 'home', label: 'Ecosystem', icon: Compass },
          { id: 'core', label: 'Level', icon: Zap },
          { id: 'vault', label: 'Vaults', icon: Lock },
          { id: 'loot', label: 'Orbital Cargo', icon: Inbox },
          { id: 'empire', label: 'Empire', icon: Users },
          { id: 'trade', label: 'Portal', icon: ArrowRightLeft },
          { id: 'leaderboard', label: 'Ranks', icon: Trophy }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-mono tracking-wider cursor-pointer transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-violet-950/75 border border-purple-500/35 text-[#d8b4fe] font-bold shadow-[0_0_12px_rgba(168,85,247,0.15)] font-display'
                  : 'text-white/55 hover:text-white/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ACTIVE SCREEN RENDER VIEWPORT */}
      <main className="flex-1 w-full z-20 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="view-home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-6"
            >
              {/* Daily loyal login checker */}
              <div className="p-5 rounded-3xl bg-dark-space/75 border border-white/5 relative overflow-hidden flex flex-col justify-between text-left">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-neon-violet" />
                    <div>
                      <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">MARG Daily Flux Booster</h4>
                      <span className="text-[10px] text-purple-300 font-mono block">Streak Level: Day 1</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-purple-950/40 border border-purple-500/20 text-[#c084fc] font-mono px-2 py-0.5 rounded-full">
                    +1500 MARG / 24h
                  </span>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleDailyClaim}
                    disabled={!isClaimAvailable()}
                    className={`flex-1 py-3.5 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isClaimAvailable()
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.45)]'
                        : 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {isClaimAvailable() ? (
                      <>
                        <Sparkles className="w-4 h-4 text-plasma-glow animate-spin" />
                        CLAIM DAILY FLUX
                      </>
                    ) : (
                      <>
                        <ClockIcon className="w-4 h-4 text-white/30" />
                        LOCKED (COOLDOWN ACTIVE)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Launcher Snapshot System Core */}
              <SnapshotBanner 
                userBalance={state.balance} 
                userLocked={state.lockedBalance} 
                referralsCount={state.referralCount} 
              />

              {/* Big Core Mining Coin Button */}
              <div className="flex flex-col items-center justify-center py-6">
                <MargToken onTap={handleTapMargToken} />
                <p className="text-[10px] font-mono text-purple-300/60 mt-3 uppercase tracking-widest animate-pulse">
                  Tapping increases liquidity database registers
                </p>
              </div>

              {/* Status footer list */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-12 h-12 bg-white/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[9px] font-mono text-purple-400 block uppercase mb-1">Holder Position</span>
                  <span className="text-lg font-display font-black text-white">{state.level}</span>
                </div>

                <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-12 h-12 bg-white/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[9px] font-mono text-purple-400 block uppercase mb-1">Holder Power</span>
                  <span className="text-lg font-display font-black text-[#c084fc] flex items-center gap-1">
                    <Zap className="w-4.5 h-4.5 text-plasma-glow animate-pulse" />
                    {state.holderPower.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'core' && (
            <motion.div
              key="view-core"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col gap-6"
            >
              <GlowSphere power={state.holderPower} level={state.level} />

              {/* Levels explanation of crystal power */}
              <div className="p-6 rounded-3xl bg-dark-space/75 border border-white/5">
                <h4 className="text-xs font-mono text-purple-300 tracking-wider uppercase mb-5 flex items-center gap-1">
                  <Award className="w-4 h-4" /> Sovereign Holder Levels
                </h4>

                <div className="flex flex-col gap-3">
                  {[
                    { name: 'Starter Holder', power: '0 — 2,500', index: '01', unlocked: true },
                    { name: 'Active Holder', power: '2,501 — 10,000', index: '02', unlocked: state.holderPower >= 2501 },
                    { name: 'Power Holder', power: '10,001 — 25,000', index: '03', unlocked: state.holderPower >= 10001 },
                    { name: 'Elite Holder', power: '25,001 — 75,000', index: '04', unlocked: state.holderPower >= 25001 },
                    { name: 'Whale Holder', power: 'Over 75,000 Power', index: '05', unlocked: state.holderPower >= 75000 },
                  ].map((lvl, index) => (
                    <div 
                      key={lvl.name}
                      className={`p-3 rounded-2xl border flex items-center justify-between font-mono text-xs transition-all ${
                        lvl.unlocked 
                          ? 'border-purple-500/20 bg-purple-950/10' 
                          : 'border-white/5 bg-black/20 opacity-55'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-purple-400/80">{lvl.index}</span>
                        <div className="text-left">
                          <span className="block text-white font-bold">{lvl.name}</span>
                          <span className="block text-[9px] text-purple-400">Min: {lvl.power} power</span>
                        </div>
                      </div>

                      {lvl.unlocked ? (
                        <span className="text-[9px] text-emerald-400 font-bold uppercase bg-emerald-950/30 py-0.5 px-2 rounded">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[9px] text-white/45 bg-black/40 py-0.5 px-2 rounded">
                          Locked
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vault' && (
            <motion.div
              key="view-vault"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <VaultView 
                balance={state.balance} 
                locks={state.locks} 
                onLock={handleLockPosition} 
              />
            </motion.div>
          )}

          {activeTab === 'loot' && (
            <motion.div
              key="view-loot"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <MysteryBoxView 
                boxesOwned={state.mysteryBoxesOwned} 
                onOpenBox={handleOpenMysteryBox} 
                onBuyBoxes={handleBuyBoxes} 
                userBalance={state.balance} 
              />
            </motion.div>
          )}

          {activeTab === 'empire' && (
            <motion.div
              key="view-empire"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <EmpireView 
                referralCount={state.referralCount} 
                referralPower={state.referralPower} 
                referralRank={state.referralRank} 
                onInvite={handleInvitePerson} 
                inviteLink={referralLink}
              />
            </motion.div>
          )}

          {activeTab === 'trade' && (
            <motion.div
              key="view-trade"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <BuyView 
                userBalance={state.balance} 
                onConfirmBuy={handleConfirmBuy} 
              />
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div
              key="view-leaderboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <LeaderboardView 
                userBalance={state.balance} 
                userPower={state.holderPower}
                claimedMilestones={state.claimedMilestones || []}
                onClaimMilestoneGift={handleClaimMilestoneGift}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Extra light clean inline Icons to prevent import bloating
function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
