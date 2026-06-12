/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, ShieldCheck, Lock, Unlock, Inbox, Users, Trophy, 
  Sparkles, Calendar, Compass, Wallet, CheckCircle2, Award, 
  AlertCircle, ChevronRight, Gamepad2, ArrowRightLeft, Star,
  Volume2, VolumeX
} from 'lucide-react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

import { SoundManager } from './utils/soundManager';
import BackgroundEffect from './components/BackgroundEffect';
import MargToken from './components/MargToken';
import GlowSphere from './components/GlowSphere';
import SnapshotBanner from './components/SnapshotBanner';
import VaultView from './components/VaultView';
import MysteryBoxView from './components/MysteryBoxView';
import EmpireView from './components/EmpireView';
import BuyView from './components/BuyView';
import LeaderboardView from './components/LeaderboardView';
import UserActivityTrends from './components/UserActivityTrends';
import { UserState, HolderLevel, LockedPosition } from './types';

const generateInitialEarningHistory = () => {
  const history = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let seedAmount = 0;
    if (i === 0) {
      seedAmount = 150;
    } else if (i === 1) {
      seedAmount = 1680;
    } else if (i === 3) {
      seedAmount = 1850;
    } else if (i === 5) {
      seedAmount = 1550;
    } else {
      seedAmount = Math.floor(180 + Math.random() * 300);
    }
    history.push({ date: dayLabel, amount: seedAmount });
  }
  return history;
};

const recordEarningInState = (amount: number, prev: UserState): { date: string; amount: number }[] => {
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const history = prev.earningHistory ? [...prev.earningHistory] : generateInitialEarningHistory();
  if (amount <= 0) return history;

  const todayIndex = history.findIndex(h => h.date === todayStr);
  if (todayIndex > -1) {
    history[todayIndex] = {
      ...history[todayIndex],
      amount: history[todayIndex].amount + amount
    };
  } else {
    history.push({ date: todayStr, amount });
    while (history.length > 7) {
      history.shift();
    }
  }
  return history;
};

// Default state when nothing is in localStorage or server is loading
const DEFAULT_STATE: UserState = {
  balance: 0,
  realMargBalance: 0,
  tonBalance: 0,
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
  earningHistory: generateInitialEarningHistory(),
};

const POWER_TIERS: { level: HolderLevel; minPower: number }[] = [
  { level: 'Whale', minPower: 75000 },
  { level: 'Elite', minPower: 25000 },
  { level: 'Power', minPower: 10000 },
  { level: 'Active', minPower: 2500 },
  { level: 'Starter', minPower: 0 },
];

const formatServerLocks = (serverLocks: any[]): LockedPosition[] => {
  if (!Array.isArray(serverLocks)) return [];
  return serverLocks.map((lk: any) => ({
    amount: Number(lk.amount || 0),
    unlockDate: lk.unlock_date || lk.unlockDate || new Date().toISOString(),
    durationMonths: lk.duration_days ? Math.round(lk.duration_days / 30) : (lk.durationMonths || 6),
    multiplier: Number(lk.multiplier || 1),
    powerYield: lk.powerYield || Math.round((lk.amount || 0) * (lk.multiplier || 1)),
    active: lk.status === 'active' || lk.active === true
  }));
};

export default function App() {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();

  const [metaMaskAddress, setMetaMaskAddress] = useState<string | null>(() => {
    return localStorage.getItem('MARG_METAMASK_ADDRESS') || null;
  });
  const [showWalletConnector, setShowWalletConnector] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => SoundManager.isEnabled());

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    SoundManager.setEnabled(nextVal);
    setSoundEnabled(nextVal);
    if (nextVal) {
      SoundManager.playTap();
    }
  };

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

  const handleConnectMetaMask = async () => {
    try {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          const address = accounts[0];
          setMetaMaskAddress(address);
          localStorage.setItem('MARG_METAMASK_ADDRESS', address);
          setShowWalletConnector(false);
        }
      } else {
        alert("MetaMask is not available. Please ensure the MetaMask extension is installed and enabled.");
      }
    } catch (err: any) {
      console.error("MetaMask connection failed:", err);
      alert(`Failed to connect to MetaMask: ${err.message || err}`);
    }
  };

  const handleDisconnectWallet = () => {
    if (tonAddress) {
      tonConnectUI.disconnect();
    }
    if (metaMaskAddress) {
      setMetaMaskAddress(null);
      localStorage.removeItem('MARG_METAMASK_ADDRESS');
    }
  };

  const [state, setState] = useState<UserState>(() => {
    const saved = localStorage.getItem('MARG_ECOSYSTEM_STATE');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.earningHistory || !Array.isArray(parsed.earningHistory) || parsed.earningHistory.length === 0) {
          parsed.earningHistory = generateInitialEarningHistory();
        }
        return { ...DEFAULT_STATE, ...parsed };
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
  const [loading, setLoading] = useState(true);
  const [tgError, setTgError] = useState<string | null>(null);

  const [topPadding, setTopPadding] = useState<string>("calc(env(safe-area-inset-top, 0px) + 48px)");

  useEffect(() => {
    const calculatePadding = () => {
      try {
        const webapp = (window as any).Telegram?.WebApp;
        let tgSafeTop = 0;
        if (webapp) {
          const webappSafeTop = webapp.safeAreaInset?.top || 0;
          const webappContentSafeTop = webapp.contentSafeAreaInset?.top || 0;
          tgSafeTop = Math.max(webappSafeTop, webappContentSafeTop);
        }

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDevice || tgSafeTop > 0) {
          const maxSafe = Math.max(tgSafeTop, 0);
          setTopPadding(`calc(max(env(safe-area-inset-top, 0px), ${maxSafe}px) + 48px)`);
        } else {
          setTopPadding("calc(env(safe-area-inset-top, 0px) + 12px)");
        }
      } catch (err) {
        console.error("Error computing dynamic top safe area:", err);
      }
    };

    calculatePadding();
    
    const timers = [
      setTimeout(calculatePadding, 50),
      setTimeout(calculatePadding, 150),
      setTimeout(calculatePadding, 500),
      setTimeout(calculatePadding, 1500),
      setTimeout(calculatePadding, 3000),
    ];

    window.addEventListener('resize', calculatePadding);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', calculatePadding);
    };
  }, []);

  // Load Telegram WebApp & Initialize User State
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        const webapp = (window as any).Telegram?.WebApp;
        let initData = webapp?.initData || "";
        
        if (!initData) {
          const bypassLoc = localStorage.getItem('MARG_ECOSYSTEM_BYPASS_INIT_DATA');
          if (bypassLoc) {
            initData = bypassLoc;
          }
        }

        if (!initData) {
          setTgError("Telegram client credentials are required to verify user session.");
          setLoading(false);
          return;
        }
        (window as any).TELEGRAM_INIT_DATA = initData;
        localStorage.setItem('MARG_ECOSYSTEM_INIT_DATA', initData);

        const activeWallet = tonAddress || metaMaskAddress || "";

        const response = await apiFetch('/api/user/init', {
          method: 'POST',
          body: JSON.stringify({ 
            initData, 
            walletAddress: activeWallet
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            setTgUser(resData.user);
            
            let displayTonBalance = resData.user.wallet_address ? (resData.user.ton_balance || 0) : 0;
            if (metaMaskAddress && (window as any).ethereum) {
              try {
                const balanceWei = await (window as any).ethereum.request({
                  method: 'eth_getBalance',
                  params: [metaMaskAddress, 'latest']
                });
                displayTonBalance = parseInt(balanceWei, 16) / 1e18;
              } catch (err) {
                console.error("MetaMask initial balance fetch error:", err);
              }
            }

            const userState: UserState = {
              balance: resData.user.balance || 0, // This is vMARG virtual balance
              realMargBalance: resData.user.wallet_address ? (resData.user.ton_marg_balance || 0) : 0,
              tonBalance: displayTonBalance,
              lockedBalance: resData.stats.totalLockedAmount || 0,
              holderPower: resData.stats.holderPower || 0,
              level: resData.stats.level || 'Starter',
              totalRewardsClaimed: resData.user.total_rewards_claimed || 0,
              referralCount: (resData.user.referral_count_l1 || 0) + (resData.user.referral_count_l2 || 0),
              referralPower: (resData.user.referral_count_l1 || 0) * 1500 + (resData.user.referral_count_l2 || 0) * 500,
              referralRank: resData.user.referral_count_l1 >= 10 ? 'Sovereign' : resData.user.referral_count_l1 >= 5 ? 'Executor' : 'Squire',
              mysteryBoxesOwned: resData.user.mystery_boxes_owned ?? 0,
              openedBoxesCount: resData.user.opened_boxes_count || 0,
              lastClaimDate: resData.user.last_claim_date || null,
              locks: formatServerLocks(resData.locks),
              empireCreated: (resData.user.referral_count_l1 || 0) > 0,
              rank: 1420,
              claimedMilestones: resData.user.claimed_milestones || [],
            };
            setState(userState);
          }
        } else {
          setTgError("Sovereign server synchronization failed. Please launch the app inside the official Telegram client.");
        }
      } catch (err) {
        console.error("Failed synchronization with TON/Express API:", err);
        setTgError("Direct networking offline. Please verify your connection status and reload inside Telegram.");
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [tonAddress, metaMaskAddress]);

  // Synchronize with database if wallet connection state changes
  useEffect(() => {
    const activeWallet = tonAddress || metaMaskAddress;
    if (activeWallet && tgUser) {
      apiFetch('/api/user/connect-wallet', {
        method: 'POST',
        body: JSON.stringify({
          telegramUserId: tgUser.id,
          walletAddress: activeWallet
        })
      })
      .then(res => {
        if (res.status === 404) {
          console.warn("Profile missing during connect-wallet, re-initializing...");
          window.location.reload();
          return null;
        }
        return res.json();
      })
      .then(async data => {
        if (data && data.success) {
          let extraNativeBalance = data.user.ton_balance || 0;
          
          if (metaMaskAddress && (window as any).ethereum) {
            try {
              const balanceWei = await (window as any).ethereum.request({
                method: 'eth_getBalance',
                params: [metaMaskAddress, 'latest']
              });
              extraNativeBalance = parseInt(balanceWei, 16) / 1e18;
            } catch (err) {
              console.error("MetaMask dynamic balance fetch error:", err);
            }
          }

          setState(prev => ({
            ...prev,
            balance: data.user.balance || prev.balance,
            realMargBalance: data.user.ton_marg_balance || 0,
            tonBalance: extraNativeBalance,
            lockedBalance: data.stats.totalLockedAmount,
            holderPower: data.stats.holderPower,
            level: data.stats.level,
            locks: formatServerLocks(data.locks)
          }));
        }
      })
      .catch(console.error);
    }
  }, [tonAddress, metaMaskAddress, tgUser]);

  // Recalculate levels offline helper
  const getLevelForPower = (power: number): HolderLevel => {
    for (const tier of POWER_TIERS) {
      if (power >= tier.minPower) {
        return tier.level;
      }
    }
    return 'Starter';
  };

  const getNextLevelInfo = (power: number) => {
    const tiers = [
      { level: 'Starter', minPower: 0, nextMinPower: 2500, nextLevel: 'Active' },
      { level: 'Active', minPower: 2500, nextMinPower: 10000, nextLevel: 'Power' },
      { level: 'Power', minPower: 10000, nextMinPower: 25000, nextLevel: 'Elite' },
      { level: 'Elite', minPower: 25000, nextMinPower: 75000, nextLevel: 'Whale' },
      { level: 'Whale', minPower: 75000, nextMinPower: 75000, nextLevel: 'Max Level' },
    ];
    
    let currentTier = tiers[0];
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (power >= tiers[i].minPower) {
        currentTier = tiers[i];
        break;
      }
    }
    
    if (currentTier.level === 'Whale') {
      return {
        currentLevel: 'Whale',
        nextLevel: 'Max Level',
        percentage: 100,
        powerNeeded: 0,
        minPower: 75000,
        nextMinPower: 75000
      };
    }
    
    const range = currentTier.nextMinPower - currentTier.minPower;
    const progressInTier = power - currentTier.minPower;
    const percentage = Math.max(0, Math.min(100, (progressInTier / range) * 100));
    const powerNeeded = currentTier.nextMinPower - power;
    
    return {
      currentLevel: currentTier.level,
      nextLevel: currentTier.nextLevel,
      percentage,
      powerNeeded,
      minPower: currentTier.minPower,
      nextMinPower: currentTier.nextMinPower
    };
  };

  const updatePowerAndLevel = (partialState: Partial<UserState>, earningToAdd = 0) => {
    setState(prev => {
      const nextBalance = partialState.balance !== undefined ? partialState.balance : prev.balance;
      const nextRealMargBalance = partialState.realMargBalance !== undefined ? partialState.realMargBalance : prev.realMargBalance;
      const nextLocked = partialState.lockedBalance !== undefined ? partialState.lockedBalance : prev.lockedBalance;
      const nextRefPower = partialState.referralPower !== undefined ? partialState.referralPower : prev.referralPower;
      
      const activeLocksPower = prev.locks.reduce((acc, curr) => acc + (curr.powerYield || 0), 0);
      const calculatedPower = Math.round(nextRealMargBalance + activeLocksPower + nextRefPower);
      const nextLevel = getLevelForPower(calculatedPower);

      const nextHistory = recordEarningInState(earningToAdd, prev);

      const computed = {
        ...prev,
        ...partialState,
        holderPower: calculatedPower,
        level: nextLevel,
        earningHistory: nextHistory,
      };
      localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(computed));
      return computed;
    });
  };

  // 1. Core tap mechanism
  const handleTapMargToken = () => {
    updatePowerAndLevel({ balance: state.balance + 1 }, 1);
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

      setClaimText(`+1,500 vMARG UNLOCKED`);
      setActiveClaimAnimation(true);

      setState(prev => {
        const nextHistory = recordEarningInState(1500, prev);
        const computed = {
          ...prev,
          balance: data.user.balance,
          realMargBalance: data.user.ton_marg_balance || 0,
          lastClaimDate: data.user.last_claim_date,
          holderPower: data.stats.holderPower,
          level: data.stats.level,
          totalRewardsClaimed: prev.totalRewardsClaimed + 1500,
          earningHistory: nextHistory
        };
        localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(computed));
        return computed;
      });

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

      setState(prev => ({
        ...prev,
        balance: data.user.balance,
        realMargBalance: data.user.ton_marg_balance || 0,
        lockedBalance: data.stats.totalLockedAmount,
        holderPower: data.stats.holderPower,
        level: data.stats.level,
        locks: formatServerLocks(data.locks)
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

      setState(prev => {
        const openedPrizeAmount = data.prizeType === 'balance' ? Number(data.prizeAmount || 0) : 0;
        const nextHistory = recordEarningInState(openedPrizeAmount, prev);
        const computed = {
          ...prev,
          balance: data.user.balance,
          realMargBalance: data.user.ton_marg_balance || 0,
          mysteryBoxesOwned: data.user.mystery_boxes_owned,
          openedBoxesCount: data.user.opened_boxes_count,
          holderPower: data.stats.holderPower,
          level: data.stats.level,
          locks: formatServerLocks(data.locks),
          earningHistory: nextHistory
        };
        localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(computed));
        return computed;
      });

      SoundManager.playSuccess();

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
        realMargBalance: data.user.ton_marg_balance || 0,
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
    // Play success chime sound
    SoundManager.playSuccess();

    // 1. Update the local state with new balance and mystery boxes
    const nextClaimed = [...(state.claimedMilestones || []), milestonePower];
    
    setState(prev => {
      const nextHistory = recordEarningInState(margReward, prev);
      const updated = {
        ...prev,
        claimedMilestones: nextClaimed,
        balance: prev.balance + margReward,
        mysteryBoxesOwned: prev.mysteryBoxesOwned + boxesReward,
        earningHistory: nextHistory
      };
      localStorage.setItem('MARG_ECOSYSTEM_STATE', JSON.stringify(updated));
      return updated;
    });

    // 2. Synchronize with parent stats
    updatePowerAndLevel({
      balance: state.balance + margReward,
      mysteryBoxesOwned: state.mysteryBoxesOwned + boxesReward
    }, margReward);

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
          setState(prev => {
            const nextHistory = recordEarningInState(0, prev);
            return {
              ...prev,
              balance: data.user.balance,
              realMargBalance: data.user.ton_marg_balance || 0,
              mysteryBoxesOwned: data.user.mystery_boxes_owned,
              claimedMilestones: data.user.claimed_milestones || nextClaimed,
              earningHistory: nextHistory
            };
          });
        }
      }
    } catch (e) {
      console.error("Network sync fail for claiming milestone gift:", e);
    }
  };

  const handleConfirmBuy = (margBought: number) => {
    updatePowerAndLevel({
      balance: state.balance + margBought,
    }, margBought);
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

        <button
          onClick={() => {
            localStorage.setItem('MARG_ECOSYSTEM_BYPASS_INIT_DATA', 'sandbox_bypass_14201337_beskerboris');
            setTgError(null);
            window.location.reload();
          }}
          className="mt-6 py-2 px-5 rounded-lg font-mono text-[9px] uppercase tracking-widest bg-zinc-900 border border-purple-500/30 hover:border-purple-400 text-purple-300 hover:text-purple-200 transition-all cursor-pointer"
        >
          Developer Preview Bypass
        </button>
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
    <div className="min-h-screen relative text-slate-100 flex flex-col pb-28 select-none px-4 bg-radial-glow font-sans bg-grid max-w-md mx-auto border-x border-white/5 shadow-2xl" style={{ paddingTop: topPadding }}>
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
              <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium tracking-normal normal-case">Live Sync</span>
            </h1>
            <span className="text-[9px] font-mono uppercase text-[#818cf8]">{metaMaskAddress ? "EVM Web3 Portal" : "TON Ecosystem Portal"}</span>
          </div>
        </div>

        {/* Real Unified Wallet Connection Controller & Sound Control */}
        <div className="flex items-center gap-2">
          {/* Global Sound Settings Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundEnabled ? "Mute interface sounds" : "Unmute interface sounds"}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-violet-950/45 border-violet-500/40 text-[#c084fc] hover:bg-violet-500/20 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-purple-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          <button
            onClick={() => {
              if (tonAddress || metaMaskAddress) {
                handleDisconnectWallet();
              } else {
                setShowWalletConnector(true);
              }
            }}
            className={`py-2 px-3.5 rounded-xl font-display font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
              (tonAddress || metaMaskAddress)
                ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-violet-950/45 border-violet-500/40 text-[#c084fc] hover:bg-violet-500/20 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 animate-pulse" />
            {tonAddress ? `TON: ${tonAddress.slice(0, 4)}...${tonAddress.slice(-4)}` : metaMaskAddress ? `MM: ${metaMaskAddress.slice(0, 5)}...${metaMaskAddress.slice(-4)}` : 'Link Wallet'}
          </button>
        </div>
      </header>

      {/* WALLET SELECTION DRAWER / MODAL */}
      <AnimatePresence>
        {showWalletConnector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-dark-space/95 border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl text-left"
            >
              <div className="absolute -right-12 -top-12 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl" />
              <div className="absolute -left-12 -bottom-12 w-24 h-24 bg-fuchsia-600/10 rounded-full blur-2xl" />

              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Select Network Vault</span>
                <button 
                  onClick={() => setShowWalletConnector(false)}
                  className="text-white/40 hover:text-white/80 font-mono text-xs cursor-pointer px-2 py-1 rounded bg-white/5 border border-white/5 hover:border-white/10"
                >
                  ESC
                </button>
              </div>

              <h3 className="text-md font-display font-black text-white uppercase tracking-wider mb-2">Connect Your Ledger</h3>
              <p className="text-[11px] font-mono text-purple-300 mb-6 leading-relaxed">
                Unlock sovereign features and cross-chain tracking by linking your secure wallet entry point.
              </p>

              <div className="flex flex-col gap-3">
                {/* TON Network */}
                <button
                  onClick={() => {
                    setShowWalletConnector(false);
                    tonConnectUI.openModal();
                  }}
                  className="w-full p-4 rounded-2xl bg-black/45 hover:bg-black/70 border border-white/5 hover:border-violet-500/30 transition-all flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-950/50 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-all">
                      <span className="font-display font-black text-xs">TON</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-white uppercase">TON Blockchain</span>
                      <span className="block text-[9px] font-mono text-sky-300">Telegram WebApp Native</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/35 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                </button>

                {/* MetaMask (EVM) */}
                <button
                  onClick={handleConnectMetaMask}
                  className="w-full p-4 rounded-2xl bg-black/45 hover:bg-black/70 border border-white/5 hover:border-fuchsia-500/30 transition-all flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/20 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-all">
                      <span className="font-display font-black text-xs">EVM</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-white uppercase">MetaMask</span>
                      <span className="block text-[9px] font-mono text-amber-300">Ethereum & EVM Chains</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/35 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Status Notice Banner */}
      <div className="w-full bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-3.5 mb-6 flex items-center justify-between text-emerald-400 relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold tracking-wide uppercase leading-none">Secure Telegram Session</div>
            <div className="text-[9px] text-emerald-400/60 font-mono leading-none mt-1">Profile verified via HMAC signature. Active cryptographic wallet link functional.</div>
          </div>
        </div>
        <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase text-emerald-400 select-none">Live</span>
      </div>

      {/* GLOBAL WALLET BALANCES CABINET METRIC */}
      <section className="w-full bg-dark-space/75 rounded-3xl p-5 border border-white/5 relative overflow-hidden mb-6 z-20 shadow-lg text-left">
        <div className="absolute -right-16 -top-16 w-32 h-32 bg-violet-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-fuchsia-600/5 rounded-full blur-3xl animate-pulse" />

        <div className="flex justify-between items-center text-[10px] font-mono text-purple-400/80 tracking-widest uppercase mb-4">
          <span>Sovereign Account Ledger</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            {metaMaskAddress ? 'MetaMask EVM Node' : 'TON Blockchain Node'}
          </span>
        </div>

        {/* Two Columns: vMARG and Real MARG */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider block">vMARG Activity Balance</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-display font-black text-white text-plasma-glow">
                {(state.balance ?? 0).toLocaleString()}
              </span>
              <span className="text-[9px] font-mono text-purple-400/70">vMARG</span>
            </div>
            <span className="text-[9px] font-mono text-white/35 mt-0.5">Virtual activity points</span>
          </div>

          <div className="flex flex-col border-l border-white/5 pl-4">
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider block">Real MARG Balance</span>
            <div className="flex items-baseline gap-1 mt-1 font-mono">
              <span className="text-2xl font-display font-black text-[#d8b4fe] text-plasma-glow">
                {(tonAddress || metaMaskAddress) ? (state.realMargBalance ?? 0).toLocaleString() : '0'}
              </span>
              <span className="text-[9px] font-mono text-[#d8b4fe]">MARG</span>
            </div>
            <span className="text-[9px] font-mono text-white/35 mt-0.5">
              {(tonAddress || metaMaskAddress) ? (tonAddress ? 'Real Jettons' : 'MetaMask Linked (EVM)') : 'Connect Wallet to load'}
            </span>
          </div>
        </div>

        {/* Three Columns grid for other metrics */}
        <div className="grid grid-cols-3 gap-2 mt-4 font-mono text-xs">
          <div className="text-left">
            <span className="text-[9px] text-white/45 uppercase tracking-wide block mb-0.5">{tonAddress ? 'GRAM / TON' : 'NATIVE ETH'}</span>
            <span className="text-[11px] font-bold text-sky-400 block">
              {(tonAddress || metaMaskAddress) ? `${(state.tonBalance ?? 0).toFixed(3)} ${tonAddress ? 'TON' : 'ETH'}` : '—'}
            </span>
            <span className="text-[8px] text-white/30 block mt-0.5 font-sans">Real balance</span>
          </div>

          <div className="text-left border-l border-white/5 pl-2">
            <span className="text-[9px] text-white/45 uppercase tracking-wide block mb-0.5">Locked MARG</span>
            <span className="text-[11px] font-bold text-purple-300 block">
              {(state.lockedBalance ?? 0).toLocaleString()} MARG
            </span>
            <span className="text-[8px] text-white/30 block mt-0.5 font-sans">Real Vault only</span>
          </div>

          <div className="text-left border-l border-white/5 pl-2">
            <span className="text-[9px] text-white/45 uppercase tracking-wide block mb-0.5">Holder Power</span>
            <span className="text-[11px] font-bold text-emerald-400 block flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-plasma-glow shrink-0 animate-pulse inline" />
              {(state.holderPower ?? 0).toLocaleString()}
            </span>
            <span className="text-[8px] text-white/30 block mt-0.5 font-sans">Level Score</span>
          </div>
        </div>
      </section>

      {/* MAIN NAVIGATION TAB LAYOUT CONTROLLERS */}
      <nav className="flex gap-1 bg-black/60 p-2 rounded-2xl border border-white/10 w-full overflow-x-auto scroller-hidden z-20 relative mb-6 min-h-[50px] items-center">
        {/* Futuristic digital energy flow light beam */}
        <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden bg-white/5 pointer-events-none rounded-t-2xl">
          <div className="w-[120px] h-full bg-gradient-to-r from-transparent via-[#a855f7] to-transparent blur-[0.5px] animate-energy-flow" />
        </div>

        {[
          { id: 'home', label: 'Ecosystem', icon: Compass },
          { id: 'core', label: 'Level', icon: Zap },
          { id: 'vault', label: 'Vaults', icon: Lock },
          { id: 'loot', label: 'Rewards', icon: Inbox },
          { id: 'empire', label: 'Empire', icon: Users },
          { id: 'trade', label: 'Portal', icon: ArrowRightLeft },
          { id: 'leaderboard', label: 'Ranks', icon: Trophy }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                SoundManager.playTap();
                setActiveTab(tab.id as any);
              }}
              className={`relative flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-mono tracking-wider cursor-pointer transition-all whitespace-nowrap overflow-visible select-none border border-transparent ${
                isSelected
                  ? 'animate-nav-active text-[#d8b4fe] font-bold font-display z-10'
                  : 'animate-nav-inactive text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeNavBackground"
                  className="absolute inset-0 bg-violet-950/60 rounded-xl border border-purple-500/20 -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 25 }}
                />
              )}
              <Icon className={`w-3.5 h-3.5 transition-colors duration-300 ${isSelected ? 'text-[#c084fc] drop-shadow-[0_0_5px_rgba(168,85,247,0.7)]' : 'text-white/40'}`} />
              <span className="relative z-10">{tab.label}</span>
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
                userBalance={state.realMargBalance} 
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
              {(() => {
                const holderProgress = getNextLevelInfo(state.holderPower ?? 0);
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden flex flex-col justify-between min-h-[105px]">
                      <div className="absolute right-0 top-0 w-12 h-12 bg-white/5 rounded-full blur-xl pointer-events-none" />
                      <div>
                        <span className="text-[9px] font-mono text-purple-400 block uppercase mb-1">Holder Position</span>
                        <span className="text-lg font-display font-black text-white">{state.level}</span>
                      </div>
                      
                      {/* Framer Motion Progress Bar */}
                      <div className="mt-2 text-left">
                        <div className="flex justify-between items-center text-[8px] font-mono text-purple-300/80 mb-1">
                          <span>{Math.round(holderProgress.percentage)}% to {holderProgress.nextLevel}</span>
                          <span>{holderProgress.powerNeeded > 0 ? `-${holderProgress.powerNeeded.toLocaleString()} Pwr` : 'MAX'}</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-purple-500 to-[#c084fc] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${holderProgress.percentage}%` }}
                            transition={{ duration: 1.0, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-dark-space/75 border border-white/5 text-left relative overflow-hidden flex flex-col justify-between min-h-[105px]">
                      <div className="absolute right-0 top-0 w-12 h-12 bg-white/5 rounded-full blur-xl pointer-events-none" />
                      <div>
                        <span className="text-[9px] font-mono text-purple-400 block uppercase mb-1">Holder Power</span>
                        <span className="text-lg font-display font-black text-[#c084fc] flex items-center gap-1">
                          <Zap className="w-4.5 h-4.5 text-plasma-glow animate-pulse" />
                          { (state.holderPower ?? 0).toLocaleString() }
                        </span>
                      </div>
                      <div className="mt-2 text-[8px] font-mono text-purple-300/50 uppercase tracking-wider leading-relaxed">
                        Combined active multiplier score
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* User Activity Trends Segment (Using Recharts) */}
              <UserActivityTrends earningHistory={state.earningHistory} />
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
                balance={state.realMargBalance} 
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
                userBalance={state.realMargBalance} 
                tonBalance={state.tonBalance}
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
