import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Award, Users, Trophy, CheckCircle2, AlertCircle, 
  ChevronRight, Copy, Share2, Plus, Edit2, Ban, Shield, 
  Activity, FileSpreadsheet, Calendar, Zap, ArrowRight, Check,
  Clock, RefreshCw, Layers, ExternalLink, HelpCircle
} from 'lucide-react';
import { SoundManager } from '../utils/soundManager';

interface GrowthViewProps {
  userBalance: number;
  userPower: number;
  telegramInitData: string;
}

export default function GrowthView({ userBalance, userPower, telegramInitData }: GrowthViewProps) {
  // Navigation tabs inside Growth Engine
  const [innerTab, setInnerTab] = useState<'dashboard' | 'missions' | 'referrals' | 'campaigns' | 'leaderboard' | 'admin'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard state
  const [growthData, setGrowthData] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [referralData, setReferralData] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [leaderboardType, setLeaderboardType] = useState<'weekly' | 'alltime'>('weekly');
  const [campaignData, setCampaignData] = useState<any>(null);
  
  // Interaction/Modals state
  const [claimsInFlight, setClaimsInFlight] = useState<Record<string, boolean>>({});
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [rewardApplying, setRewardApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  
  // Admin Panel states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminReferrals, setAdminReferrals] = useState<any[]>([]);
  const [adminXpHistory, setAdminXpHistory] = useState<any[]>([]);
  const [adminRewards, setAdminRewards] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  
  // Admin Forms
  const [adminXpTargetUser, setAdminXpTargetUser] = useState('');
  const [adminXpAmount, setAdminXpAmount] = useState('500');
  const [adminXpReason, setAdminXpReason] = useState('Community event contribution bonus');
  const [adminXpFormMessage, setAdminXpFormMessage] = useState('');
  const [adminXpFormError, setAdminXpFormError] = useState('');
  
  // Admin Create Mission Form
  const [newMissionId, setNewMissionId] = useState('');
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionDescription, setNewMissionDescription] = useState('');
  const [newMissionType, setNewMissionType] = useState('social');
  const [newMissionXp, setNewMissionXp] = useState('100');
  const [newMissionValType, setNewMissionValType] = useState('auto');
  const [newMissionUrl, setNewMissionUrl] = useState('');
  const [newMissionMessage, setNewMissionMessage] = useState('');
  
  // Admin Create Campaign Form
  const [newCampId, setNewCampId] = useState('');
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [newCampPool, setNewCampPool] = useState('100 TON');
  const [newCampRules, setNewCampRules] = useState('');
  const [newCampMessage, setNewCampMessage] = useState('');

  // Admin Payout forms
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [payoutTxHash, setPayoutTxHash] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'x-telegram-init-data': telegramInitData
  };

  // 1. Initial Load of growth dashboard on mount
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/growth/me', { headers });
      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to fetch growth profile.');
      }
      const data = await res.json();
      if (data.success) {
        setGrowthData(data.growth);
      }
    } catch (err: any) {
      console.error("[GROWTH VIEW LOAD ERROR]", err);
      setError(err.message || 'An error occurred loading growth parameters.');
    } finally {
      setLoading(false);
    }
  };

  // Load missions
  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/growth/missions', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMissions(data.missions);
        }
      }
    } catch (e) {
      console.error("Missions fetch error", e);
    }
  };

  // Load referrals
  const fetchReferrals = async () => {
    try {
      const res = await fetch('/api/growth/referrals', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReferralData(data);
        }
      }
    } catch (e) {
      console.error("Referrals fetch error", e);
    }
  };

  // Load leaderboard details
  const fetchLeaderboard = async (type = leaderboardType) => {
    try {
      const res = await fetch(`/api/growth/leaderboard?type=${type}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLeaderboardData(data);
        }
      }
    } catch (e) {
      console.error("Growth leaderboard fetch error", e);
    }
  };

  // Load campaigns & rewards
  const fetchCampaignsAndRewards = async () => {
    try {
      const res = await fetch('/api/growth/rewards', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCampaignData(data);
        }
      }
    } catch (e) {
      console.error("Campaigns fetch error", e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchMissions();
    fetchReferrals();
    fetchLeaderboard();
    fetchCampaignsAndRewards();
  }, [innerTab]);

  // Load Admin Data
  const loadAdminData = async () => {
    try {
      setAdminLoading(true);
      const [uRes, rRes, xRes, rewRes] = await Promise.all([
        fetch('/api/admin/growth/users', { headers }),
        fetch('/api/admin/growth/referrals', { headers }),
        fetch('/api/admin/growth/xp-history', { headers }),
        fetch('/api/admin/growth/rewards', { headers })
      ]);

      if (uRes.ok) {
        const u = await uRes.json();
        if (u.success) setAdminUsers(u.users);
      }
      if (rRes.ok) {
        const r = await rRes.json();
        if (r.success) setAdminReferrals(r.referrals);
      }
      if (xRes.ok) {
        const x = await xRes.json();
        if (x.success) setAdminXpHistory(x.history);
      }
      if (rewRes.ok) {
        const rew = await rewRes.json();
        if (rew.success) setAdminRewards(rew.rewards);
      }
    } catch (err) {
      console.error("Failed loading admin ledger tables", err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (innerTab === 'admin' && growthData?.isAdmin) {
      loadAdminData();
    }
  }, [innerTab, growthData]);

  // Handle Copy Link Helper
  const handleCopyInviteLink = () => {
    SoundManager.playSuccess();
    const link = referralData?.inviteLink || `https://t.me/marg_ecosystem_bot/app?startapp=ref_${growthData?.id || 'node'}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Trigger Daily Check-in Claim
  const handleDailyCheckIn = async () => {
    if (checkInLoading) return;
    SoundManager.playTap();
    setCheckInLoading(true);
    try {
      const res = await fetch('/api/growth/daily-checkin', {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed checking in.");
      }
      if (data.success) {
        SoundManager.playSuccess();
        // play haptic and refresh state
        alert(`🎁 Daily Check-in Successful!\nAwarded: +25 XP\nStreak: ${data.streak} Days!\n${data.dailyBonusAwarded ? "🔥 BOOM! All daily tasks complete: +100 bonus XP awarded!" : ""}`);
        fetchDashboardData();
        fetchMissions();
      }
    } catch (err: any) {
      alert(err.message || "Daily Check-in failed");
    } finally {
      setCheckInLoading(false);
    }
  };

  // Trigger Mission Task Claim & Validation
  const handleClaimMission = async (missionId: string, title: string) => {
    if (claimsInFlight[missionId]) return;
    SoundManager.playTap();
    setClaimsInFlight(prev => ({ ...prev, [missionId]: true }));
    try {
      const res = await fetch(`/api/growth/missions/${missionId}/claim`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verify & Claim conditions not qualified.");
      }
      if (data.success) {
        SoundManager.playSuccess();
        alert(`🎯 Verified & Completed!\nMission: ${title}\nAwarded: +${data.xpAwarded} XP points!\n${data.dailyBonusAwarded ? "🔥 BOOM! All daily tasks complete: +100 bonus XP awarded!" : ""}`);
        fetchDashboardData();
        fetchMissions();
      }
    } catch (err: any) {
      alert(err.message || "Verification parameters not qualified. Please satisfy target parameters and try again.");
    } finally {
      setClaimsInFlight(prev => ({ ...prev, [missionId]: false }));
    }
  };

  // Apply for active campaign
  const handleApplyCampaign = async (campaignId: string) => {
    SoundManager.playTap();
    setRewardApplying(true);
    setApplyMessage(null);
    setApplyError(null);
    try {
      const res = await fetch('/api/growth/rewards/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed applying.");
      }
      if (data.success) {
        SoundManager.playSuccess();
        setApplyMessage("🎉 Qualification Application Submitted! Your connected TON wallet will be audited within 24-48 hours.");
        fetchCampaignsAndRewards();
        fetchDashboardData();
      }
    } catch (err: any) {
      setApplyError(err.message || "Failed applying for campaign reward pools.");
    } finally {
      setRewardApplying(false);
    }
  };

  // ADMIN ACTION: Adjust user XP
  const handleAdminXpAdjust = async (actionType: 'add' | 'ban' | 'unban' = 'add') => {
    if (!adminXpTargetUser) return;
    SoundManager.playTap();
    setAdminXpFormMessage('');
    setAdminXpFormError('');
    try {
      const res = await fetch('/api/admin/growth/xp/manual', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: adminXpTargetUser,
          amount: actionType === 'add' ? Number(adminXpAmount) : 0,
          reason: adminXpReason,
          actionType
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed admin command");
      if (data.success) {
        SoundManager.playSuccess();
        setAdminXpFormMessage(data.message);
        loadAdminData();
      }
    } catch (e: any) {
      setAdminXpFormError(e.message || "Admin command error");
    }
  };

  // ADMIN ACTION: Create new custom mission card dynamically
  const handleAdminCreateMission = async () => {
    if (!newMissionId || !newMissionTitle) return;
    SoundManager.playTap();
    setNewMissionMessage('');
    try {
      const res = await fetch('/api/admin/growth/missions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mission_id: newMissionId,
          title: newMissionTitle,
          description: newMissionDescription,
          type: newMissionType,
          xp_reward: Number(newMissionXp),
          is_daily: newMissionType === 'daily',
          is_active: true,
          validation_type: newMissionValType,
          external_url: newMissionUrl
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        SoundManager.playSuccess();
        setNewMissionMessage("Custom Growth Card Added Successfully!");
        setNewMissionId('');
        setNewMissionTitle('');
        setNewMissionDescription('');
        fetchMissions();
        loadAdminData();
      } else {
        alert(data.error || "Failed adding custom mission card");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ADMIN ACTION: Create custom contest campaign
  const handleAdminCreateCampaign = async () => {
    if (!newCampId || !newCampTitle) return;
    SoundManager.playTap();
    setNewCampMessage('');
    try {
      const res = await fetch('/api/admin/growth/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          campaign_id: newCampId,
          title: newCampTitle,
          description: newCampDesc,
          prize_pool: newCampPool,
          rules: newCampRules
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        SoundManager.playSuccess();
        setNewCampMessage("Custom Campaign Created Successfully!");
        setNewCampId('');
        setNewCampTitle('');
        setNewCampDesc('');
        fetchCampaignsAndRewards();
        loadAdminData();
      } else {
        alert(data.error || "Failed adding custom campaign details");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ADMIN ACTION: Approve reward qualification entry
  const handleAdminRewardApprove = async (rewId: string) => {
    SoundManager.playTap();
    try {
      const hash = prompt("Input Web3 TON Transaction Outbound Hash (hash payload makes state PAID, empty is APPROVED):");
      if (hash === null) return; // cancelled
      const res = await fetch(`/api/admin/growth/rewards/${rewId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transactionHash: hash })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        SoundManager.playSuccess();
        alert("Campaign payout approved successfully.");
        loadAdminData();
      }
    } catch (e: any) {
      alert(e.message || "Failed approval cmd");
    }
  };

  // ADMIN ACTION: Reject reward qualification entry
  const handleAdminRewardReject = async (rewId: string) => {
    SoundManager.playTap();
    const reason = prompt("Describe payout rejection audit trail reason:");
    if (reason === null) return;
    try {
      const res = await fetch(`/api/admin/growth/rewards/${rewId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        SoundManager.playSuccess();
        alert("Campaign payout entry rejected.");
        loadAdminData();
      }
    } catch (e: any) {
      alert(e.message || "Failed reject cmd");
    }
  };

  // Calculate inner level indicators
  const getProgressToNextLevel = () => {
    if (!growthData) return { pct: 0, required: 0 };
    const xp = growthData.totalXp;
    const nextLimit = growthData.nextXp;
    const prevLimit = growthData.prevXp;
    if (nextLimit === prevLimit) return { pct: 100, required: 0 };
    const pct = Math.min(100, Math.max(0, ((xp - prevLimit) / (nextLimit - prevLimit)) * 100));
    return {
      pct,
      required: Math.max(0, nextLimit - xp)
    };
  };

  const currentLevelProgress = getProgressToNextLevel();

  return (
    <div className="w-full text-white min-h-[500px]" id="growth_engine_hub">
      {/* 1. Header Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black border border-purple-500/10 p-5 overflow-hidden text-left mb-6 shadow-2xl">
        <div className="absolute right-0 top-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[9px] font-mono tracking-widest text-purple-300 uppercase animate-pulse">MARG growth engine</span>
              {growthData?.isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 text-[9px] font-mono text-[#34d399] uppercase select-none font-bold">Admin Privileged</span>
              )}
            </div>
            <h1 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
              Growth Hub <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
            </h1>
            <p className="text-white/60 text-xs font-mono max-w-[280px] leading-relaxed mt-1">
              Engage social nodes, complete on-chain missions, and stake keys to collect network rewards.
            </p>
          </div>

          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-mono text-white/40 uppercase">Total User XP</span>
            <span className="text-2xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#c084fc] drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
              {(growthData?.totalXp || 0).toLocaleString()}
            </span>
            <div className="mt-1 text-[9px] font-mono text-purple-300 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-md">
              LVL {growthData?.level || 1} &bull; {growthData?.rank || "Explorer"}
            </div>
          </div>
        </div>

        {/* Level Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-[10px] font-mono text-purple-300/80 mb-1">
            <span>Level {growthData?.level || 1} ({growthData?.rank || "Explorer"})</span>
            <span>{currentLevelProgress.required > 0 ? `${currentLevelProgress.required.toLocaleString()} XP to Next Level` : "MAX LEVEL"}</span>
          </div>
          <div className="h-2 w-full bg-black/40 rounded-full border border-white/5 overflow-hidden p-[1px]">
            <motion.div 
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-[#c084fc] rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${currentLevelProgress.pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white blur-sm opacity-50" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* 2. Inner navigation panels */}
      <div className="flex gap-1.5 overflow-x-auto scroller-hidden mb-6 pb-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'missions', label: 'all Missions', icon: Layers },
          { id: 'referrals', label: 'Network Info', icon: Users },
          { id: 'campaigns', label: 'Contests', icon: Trophy },
          { id: 'leaderboard', label: 'Standings', icon: Trophy },
          ...(growthData?.isAdmin ? [{ id: 'admin', label: 'Admin Desk', icon: Shield }] : [])
        ].map(item => {
          const Icon = item.icon;
          const selected = innerTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                SoundManager.playTap();
                setInnerTab(item.id as any);
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-mono tracking-wider cursor-pointer whitespace-nowrap transition-all border ${
                selected 
                  ? 'bg-purple-950/50 text-[#d8b4fe] border-purple-500/30 font-bold'
                  : 'bg-black/30 text-white/50 border-white/5 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loader indicator state */}
      {loading && (
        <div className="py-12 text-center text-white/40 font-mono text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          <span>Synchronizing secure live sandbox ledger parameters...</span>
        </div>
      )}

      {/* Primary Container */}
      {!loading && (
        <AnimatePresence mode="wait">
          {/* Dashboard Panel */}
          {innerTab === 'dashboard' && growthData && (
            <motion.div
              key="panel-dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Daily Check-in Card */}
              <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/20 via-black to-black p-4 text-left relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-mono text-purple-400 uppercase tracking-widest block mb-1">Daily Streak Node sync</span>
                    <h3 className="text-mid text-white font-display font-bold">Streak Calendar: <span className="text-[#c084fc]">{growthData.referrals.totalInvited >= 10 ? growthData.referrals.totalInvited + 5 : growthData.growth_level || 3} Days</span></h3>
                    <p className="text-[11px] font-mono text-white/50 mt-1 max-w-[280px]">
                      Claim consecutive log-in synchronizations to award points. Broken streaks drop to Day 1.
                    </p>
                  </div>
                  <button
                    onClick={handleDailyCheckIn}
                    disabled={checkInLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 active:scale-95 text-xs text-white font-mono font-bold border border-purple-400/20 disabled:opacity-40 animate-pulse cursor-pointer shadow-lg hover:shadow-purple-500/10"
                  >
                    {checkInLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Claim +25 XP
                  </button>
                </div>
              </div>

              {/* Grid 1: Basic summary metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-dark-space/40 border border-white/5 text-left relative overflow-hidden">
                  <span className="text-[9px] font-mono text-purple-400 block uppercase mb-1">completed missions</span>
                  <span className="text-xl font-display font-medium text-white">{growthData.completedTasks} <span className="text-white/30 text-xs font-mono">claimed</span></span>
                  <div className="mt-2 text-[8px] font-mono text-white/40 flex items-center justify-between">
                    <span>{growthData.availableTasks} pending task cards</span>
                    <button onClick={() => setInnerTab('missions')} className="text-[#c084fc] flex items-center">view &bull; <ChevronRight className="w-2.5 h-2.5" /></button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-dark-space/40 border border-white/5 text-left relative overflow-hidden">
                  <span className="text-[9px] font-mono text-[#38bdf8] block uppercase mb-1">Referral Rewards</span>
                  <span className="text-xl font-display font-medium text-white">{(growthData.referrals.xpEarned || 0).toLocaleString()} <span className="text-[#38bdf8]/50 text-xs font-mono">earned</span></span>
                  <div className="mt-2 text-[8px] font-mono text-white/40 flex items-center justify-between">
                    <span>{growthData.referrals.totalInvited} invited members</span>
                    <button onClick={() => setInnerTab('referrals')} className="text-[#38bdf8] flex items-center">links &bull; <ChevronRight className="w-2.5 h-2.5" /></button>
                  </div>
                </div>
              </div>

              {/* Grid 2: Wallet & Token & Vaults states */}
              <div className="grid grid-cols-3 gap-2 text-left">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">TON Connect</span>
                  <div className="text-xs font-bold truncate mt-1 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${growthData.wallet.connected ? 'bg-[#10b981]' : 'bg-amber-500 animate-pulse'}`} />
                    {growthData.wallet.connected ? 'Linked' : 'Not Linked'}
                  </div>
                  <span className="text-[8px] font-mono text-white/40 block mt-1 truncate">{growthData.wallet.address || 'Address missing'}</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">MARG jettons</span>
                  <div className="text-xs font-bold mt-1 text-[#c084fc]">
                    {(growthData.token.balance).toLocaleString()} MARG
                  </div>
                  <span className="text-[8px] font-mono text-white/40 block mt-1">on-chain live ledger</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">Locks / vaults</span>
                  <div className="text-xs font-bold mt-1 text-white flex items-center gap-1">
                    <span>{growthData.vault.hasActiveLock ? 'ACTIVE' : 'NONE'}</span>
                    {growthData.vault.hasActiveLock && <span className="text-[9px] text-[#34d399] font-mono">({growthData.vault.activeMultiplier}x)</span>}
                  </div>
                  <span className="text-[8px] font-mono text-white/40 block mt-1">{growthData.vault.totalLockedAmount.toLocaleString()} locked MARG</span>
                </div>
              </div>

              {/* Dynamic Action Call Out */}
              <div className="p-4 rounded-xl bg-[#c084fc]/5 border border-purple-500/20 text-left flex justify-between items-center relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-20 bg-[#c084fc]/5 rounded-tl-full blur-xl" />
                <div>
                  <h4 className="text-xs font-mono text-[#d8b4fe] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Contests &amp; Airdrop Pools
                  </h4>
                  <p className="text-[11px] text-white/60 mt-1 max-w-[280px]">
                    Qualified members who hold MARG and complete social checkpoints can apply for airdrops.
                  </p>
                </div>
                <button
                  onClick={() => setInnerTab('campaigns')}
                  className="bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-[10px] font-mono text-white border border-white/10 cursor-pointer transition-all flex items-center gap-1"
                >
                  Verify Now <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Missions List Tab */}
          {innerTab === 'missions' && (
            <motion.div
              key="panel-missions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="text-left mb-2">
                <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">Mission Command Center</h3>
                <p className="text-[10px] font-mono text-white/40 leading-relaxed mt-0.5">
                  Complete social checklists, verify holding records, and claim instant node XP. Daily tasks refresh at 00:00 UTC.
                </p>
              </div>

              {/* Daily Checklist Group */}
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-left">
                <span className="text-[8px] font-mono uppercase bg-purple-950/40 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded">Daily Reset Tasks</span>
                <div className="mt-2.5 space-y-2">
                  {missions.filter(m => m.is_daily).map(mission => (
                    <div 
                      key={mission.mission_id}
                      className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {mission.title}
                          {mission.status === 'claimed' && <CheckCircle2 className="w-3 h-3 text-[#10b981]" />}
                        </h4>
                        <p className="text-[10px] text-white/50 font-mono mt-0.5">{mission.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#c084fc] font-bold">+{mission.xp_reward} XP</span>
                        {mission.status === 'claimed' ? (
                          <span className="px-2.5 py-1 rounded-md bg-white/5 text-[9px] font-mono text-white/30 border border-transparent">Claimed</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (mission.external_url) {
                                window.open(mission.external_url, '_blank');
                              }
                              handleClaimMission(mission.mission_id, mission.title);
                            }}
                            disabled={claimsInFlight[mission.mission_id]}
                            className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 px-3 py-1 rounded-md text-[9px] font-mono text-purple-200 cursor-pointer disabled:opacity-30"
                          >
                            {claimsInFlight[mission.mission_id] ? "Claiming..." : "Verify"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onboarding & Social & On-Chain Holdings lists */}
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-left">
                <span className="text-[8px] font-mono uppercase bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 px-2 py-0.5 rounded">One-time Milestones</span>
                <div className="mt-2.5 space-y-2">
                  {missions.filter(m => !m.is_daily).map(mission => (
                    <div 
                      key={mission.mission_id}
                      className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {mission.title}
                          {mission.status === 'claimed' && <CheckCircle2 className="w-3 h-3 text-[#10b981]" />}
                        </h4>
                        <p className="text-[10px] text-white/50 font-mono mt-0.5">{mission.description}</p>
                        {mission.validation_type !== 'auto' && (
                          <span className="inline-block mt-1 text-[8px] font-mono text-white/30 uppercase bg-white/5 px-1.5 py-0.2 rounded border border-white/5">
                            Check: {mission.validation_type.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#c084fc] font-bold">+{mission.xp_reward} XP</span>
                        {mission.status === 'claimed' ? (
                          <span className="px-2.5 py-1 rounded-md bg-white/5 text-[9px] font-mono text-white/30">Claimed</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (mission.external_url) {
                                window.open(mission.external_url, '_blank');
                              }
                              handleClaimMission(mission.mission_id, mission.title);
                            }}
                            disabled={claimsInFlight[mission.mission_id]}
                            className="bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/20 px-3 py-1 rounded-md text-[9px] font-mono text-indigo-300 cursor-pointer disabled:opacity-30"
                          >
                            {claimsInFlight[mission.mission_id] ? "Claiming..." : "Verify"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Network referrals and invitations list */}
          {innerTab === 'referrals' && referralData && (
            <motion.div
              key="panel-referrals"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Box info */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/20 to-black border border-cyan-500/10 text-left">
                <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest block mb-1">Network Referral System</span>
                <h3 className="text-md font-display font-medium text-white">Generate L1 &amp; L2 Multi-tier Rewards</h3>
                <p className="text-[11px] font-mono text-white/60 mt-1 max-w-[310px] leading-relaxed">
                  Refer friends using your custom code. Earn <span className="text-cyan-300 font-bold">100 XP</span> + 150 XP when they connect a TON wallet + 300 XP when their purchase is verified on-chain.
                </p>

                {/* Invite link copy action */}
                <div className="mt-4 flex gap-1.5">
                  <div className="bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs font-mono text-white/70 select-all truncate flex-1 leading-none align-middle flex items-center justify-start">
                    {referralData.inviteLink}
                  </div>
                  <button
                    onClick={handleCopyInviteLink}
                    className="p-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-mono rounded-xl cursor-pointer transition-all flex items-center gap-1 font-bold"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Grid Invite ranks */}
              <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 text-left">
                <div>
                  <span className="text-[8px] font-mono text-white/40 uppercase block">Invited Count</span>
                  <span className="text-xl font-display font-bold text-white mt-1 block">{referralData.stats.totalInvited}</span>
                </div>
                <div>
                  <span className="text-[8px] font-mono text-white/40 uppercase block">Wallet Link Complete</span>
                  <span className="text-xl font-display font-bold text-cyan-400 mt-1 block">{referralData.stats.walletConnected}</span>
                </div>
                <div>
                  <span className="text-[8px] font-mono text-white/40 uppercase block">Direct XP Earned</span>
                  <span className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#c084fc] mt-1 block">{referralData.stats.xpEarned} XP</span>
                </div>
              </div>

              {/* Referral Members table */}
              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-left">
                <span className="text-[8px] font-mono uppercase text-white/40">network members</span>
                {referralData.referrals.length === 0 ? (
                  <div className="py-6 text-center text-[11px] font-mono text-white/30">
                    No active referrals registered inside your tree node yet. Share your link to start earning.
                  </div>
                ) : (
                  <div className="mt-2.5 space-y-1.5">
                    {referralData.referrals.map((item: any, i: number) => (
                      <div 
                        key={i}
                        className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            @{item.username || `user_${item.telegramId}`}
                            <span className="px-1 py-0.1 bg-white/5 rounded text-[8px] font-mono text-white/40">LVL {item.level}</span>
                          </div>
                          <span className="text-[8px] font-mono text-white/30 block mt-0.5">Joined: {new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1 font-mono text-[9px]">
                          <div className="flex gap-1">
                            <span className={`px-1.5 py-0.2 rounded ${item.walletConnected ? 'bg-green-950/40 text-green-400 border border-green-500/20' : 'bg-white/5 text-white/30'}`}>Wallet</span>
                            <span className={`px-1.5 py-0.2 rounded ${item.purchaseVerified ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20' : 'bg-white/5 text-white/30'}`}>TON Accumulate</span>
                          </div>
                          <span className="text-[8px] font-bold text-purple-300">Awarded: +{item.xpAwarded} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Campaigns and giveaways application */}
          {innerTab === 'campaigns' && campaignData && (
            <motion.div
              key="panel-campaigns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {campaignData.campaigns.map((camp: any) => {
                const appliedRecord = campaignData.rewards.find((r: any) => r.campaign_id === camp.campaign_id);
                return (
                  <div 
                    key={camp.campaign_id}
                    className="p-4 rounded-xl border border-purple-500/20 bg-gradient-to-br from-indigo-950/25 via-black to-black text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-1.5 py-0.2 bg-purple-500/10 border border-purple-500/20 text-[#d8b4fe] text-[8px] font-mono rounded uppercase">Active contest campaign</span>
                        <h3 className="text-md font-display font-black text-white mt-1">{camp.title}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-mono text-white/40 block">CONTEST POOL</span>
                        <span className="text-md font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">{camp.prize_pool}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/60 leading-relaxed mt-2.5 font-mono">
                      {camp.description}
                    </p>

                    {/* Rules */}
                    <div className="mt-4 bg-black/40 border border-white/5 rounded-lg p-3 text-xs">
                      <span className="text-[8px] font-mono text-white/40 uppercase block mb-1">Qualification Requirements</span>
                      <pre className="text-[10px] font-mono text-purple-300 whitespace-pre-wrap leading-relaxed">
                        {camp.rules}
                      </pre>
                    </div>

                    {/* Applications status trigger */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                      <div className="font-mono text-[10px]">
                        {appliedRecord ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/40">Status:</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${
                              appliedRecord.status === 'paid' ? 'bg-green-950/40 text-[#c084fc]' :
                              appliedRecord.status === 'approved' ? 'bg-green-950/40 text-green-400' :
                              appliedRecord.status === 'rejected' ? 'bg-red-950/40 text-red-400' :
                              'bg-amber-950/40 text-amber-400 animate-pulse'
                            }`}>
                              {appliedRecord.status === 'paid' ? 'Claimed' : appliedRecord.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/30">Connect Wallet and apply</span>
                        )}
                      </div>

                      {appliedRecord ? (
                        appliedRecord.status === 'paid' ? (
                          <span className="text-[10px] font-mono text-purple-400">Awarded successfully</span>
                        ) : (
                          <button disabled className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-mono text-white/30">
                            Verification Pending
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleApplyCampaign(camp.campaign_id)}
                          disabled={rewardApplying || !growthData?.wallet?.connected}
                          className="bg-purple-900/40 hover:bg-purple-900/50 border border-purple-500/30 px-4 py-1.5 rounded-lg text-[10px] font-mono text-[#d8b4fe] cursor-pointer font-bold select-none disabled:opacity-30"
                        >
                          {rewardApplying ? "Submitting..." : "Apply Entry"}
                        </button>
                      )}
                    </div>

                    {applyMessage && <div className="mt-3 p-2 bg-green-950/30 text-green-400 font-mono text-[9px] rounded border border-green-500/20">{applyMessage}</div>}
                    {applyError && <div className="mt-3 p-2 bg-red-950/30 text-red-400 font-mono text-[9px] rounded border border-red-500/20">{applyError}</div>}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Growth stand-alone Leaderboard tab */}
          {innerTab === 'leaderboard' && (
            <motion.div
              key="panel-lead"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">Growth Leader Standings</h3>
                  <p className="text-[10px] font-mono text-white/40">Track highly active nodes based on XP accumulated.</p>
                </div>
                
                {/* Switcher */}
                <div className="flex bg-black/40 border border-white/5 rounded-lg p-0.5">
                  <button 
                    onClick={() => { setLeaderboardType('weekly'); fetchLeaderboard('weekly'); }}
                    className={`px-2.5 py-1 text-[9px] font-mono rounded cursor-pointer ${leaderboardType === 'weekly' ? 'bg-purple-950 text-[#d8b4fe]' : 'text-white/50'}`}
                  >
                    Weekly
                  </button>
                  <button 
                    onClick={() => { setLeaderboardType('alltime'); fetchLeaderboard('alltime'); }}
                    className={`px-2.5 py-1 text-[9px] font-mono rounded cursor-pointer ${leaderboardType === 'alltime' ? 'bg-purple-950 text-[#d8b4fe]' : 'text-white/50'}`}
                  >
                    All-time
                  </button>
                </div>
              </div>

              {/* Competitors List */}
              <div className="rounded-xl border border-white/5 bg-black/20 p-2.5 text-left">
                {leaderboardData ? (
                  <div className="space-y-1">
                    {leaderboardData.leaderboard.slice(0, 15).map((item: any, idx: number) => (
                      <div 
                        key={idx}
                        className={`p-2.5 rounded-lg flex items-center justify-between text-xs transition-all ${
                          item.isCurrentUser 
                            ? 'bg-purple-950/30 border border-purple-500/30 text-[#d8b4fe]' 
                            : 'bg-black/30 border border-white/5 text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 text-center font-display font-bold text-[10px] ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-600' : 'text-white/30'}`}>
                            #{item.rank}
                          </span>
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              {item.firstName}
                              {item.isCurrentUser && <span className="text-[8px] bg-purple-500 text-white px-1.5 rounded uppercase font-mono">You</span>}
                            </div>
                            <span className="text-[8px] text-white/40 block">LVL {item.level} &bull; {item.levelTitle}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono text-[10px]">
                          <span className="font-bold text-[#c084fc]">{item.xp.toLocaleString()}</span>
                          <span className="text-white/40 text-[8px] block uppercase">Earned XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-mono text-white/30">Loading standing sheets...</div>
                )}
              </div>
            </motion.div>
          )}

          {/* Admin controller view desk */}
          {innerTab === 'admin' && growthData?.isAdmin && (
            <motion.div
              key="panel-admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="text-left border-b border-white/5 pb-2">
                <h3 className="text-md font-display font-black text-[#10b981] uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" /> Admin Controller Desk
                </h3>
                <p className="text-[10px] font-mono text-white/40 mt-0.5">
                  Direct live access to DB node entries, manual XP rewards operations, campaigns auditing, and reports downloads.
                </p>
              </div>

              {adminLoading ? (
                <div className="py-8 text-center text-[10px] font-mono text-white/30 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#10b981]" /> Loads table data...
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  {/* CSV Export Button */}
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-mono text-emerald-400 uppercase">Snapshot Audit Log Report</span>
                      <h4 className="text-xs font-bold text-white mt-1">Export growth member parameters</h4>
                    </div>
                    <a
                      href={`/api/admin/growth/export?x-tg-data=${telegramInitData}`}
                      target="_blank"
                      className="bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 font-mono text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Export CSV
                    </a>
                  </div>

                  {/* Manual XP Grant & Ban Panel */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-3">
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">adjust user metadata</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[9px] font-mono text-white/40 block mb-1">Target Telegram ID</label>
                        <select
                          value={adminXpTargetUser}
                          onChange={(e) => setAdminXpTargetUser(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="">-- Choose User --</option>
                          {adminUsers.map(u => (
                            <option key={u.telegramId} value={u.telegramId}>@{u.username || u.telegramId} ({u.firstName})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-white/40 block mb-1">XP adjustment amount</label>
                        <input
                          type="number"
                          value={adminXpAmount}
                          onChange={(e) => setAdminXpAmount(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded px-2.5 py-1.2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-mono text-white/40 block mb-1">Operation Audit Trail Reason</label>
                      <input
                        type="text"
                        value={adminXpReason}
                        onChange={(e) => setAdminXpReason(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded px-2.5 py-1.2 text-xs text-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAdminXpAdjust('add')}
                        disabled={!adminXpTargetUser}
                        className="flex-1 bg-emerald-900/30 hover:bg-emerald-900/50 border border-[#10b981]/30 text-emerald-300 text-xs py-1.5 rounded cursor-pointer disabled:opacity-30"
                      >
                        Adjust XP
                      </button>
                      <button
                        onClick={() => handleAdminXpAdjust('ban')}
                        disabled={!adminXpTargetUser}
                        className="bg-red-950/30 hover:bg-red-900/30 border border-red-500/20 text-red-400 text-xs px-2.5 py-1.5 rounded cursor-pointer disabled:opacity-30"
                      >
                        Ban Frame
                      </button>
                      <button
                        onClick={() => handleAdminXpAdjust('unban')}
                        disabled={!adminXpTargetUser}
                        className="bg-slate-950/30 hover:bg-white/5 border border-white/10 text-white/60 text-xs px-2.5 py-1.5 rounded cursor-pointer disabled:opacity-30"
                      >
                        Unlock
                      </button>
                    </div>
                    {adminXpFormMessage && <div className="text-[9px] font-mono text-emerald-400">{adminXpFormMessage}</div>}
                    {adminXpFormError && <div className="text-[9px] font-mono text-red-400">{adminXpFormError}</div>}
                  </div>

                  {/* Pending campaign allocations audit */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">Outbound Rewards Distribution</span>
                    <div className="mt-2.5 space-y-2">
                      {adminRewards.length === 0 ? (
                        <div className="text-center py-4 text-[10px] text-white/30 font-mono">No reward payout record logs in database.</div>
                      ) : (
                        adminRewards.map((reward: any) => (
                          <div key={reward.id} className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-xs space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">UID: {reward.user_id}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono uppercase ${
                                reward.status === 'paid' ? 'bg-green-950/40 text-[#c084fc]' :
                                reward.status === 'approved' ? 'bg-green-950/40 text-green-400' :
                                reward.status === 'rejected' ? 'bg-red-950/40 text-red-500' : 'bg-amber-950/40 text-amber-500'
                              }`}>{reward.status}</span>
                            </div>
                            <div className="text-[10px] font-mono text-white/60">
                              Campaign: {reward.campaign_id} &bull; Allocation: {reward.amount} {reward.reward_type}
                            </div>
                            {reward.transaction_hash && (
                              <div className="text-[8px] font-mono text-purple-300 break-all select-all">
                                TX: {reward.transaction_hash}
                              </div>
                            )}

                            {reward.status === 'pending' && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleAdminRewardApprove(reward.id)}
                                  className="flex-1 bg-green-900/30 border border-green-500/20 text-green-300 py-1 rounded text-[10px] font-mono cursor-pointer"
                                >
                                  Approve / Pay Out
                                </button>
                                <button
                                  onClick={() => handleAdminRewardReject(reward.id)}
                                  className="bg-red-950/30 border border-red-500/10 text-red-400 px-2.5 py-1 rounded text-[10px] font-mono cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Admin create Dynamic Mission */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-3">
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">Add custom mission card</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Unique Mission ID</label>
                        <input
                          type="text"
                          placeholder="join_discord"
                          value={newMissionId}
                          onChange={(e) => setNewMissionId(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Mission Title</label>
                        <input
                          type="text"
                          placeholder="Join Official Discord"
                          value={newMissionTitle}
                          onChange={(e) => setNewMissionTitle(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-mono text-white/40 block mb-0.5">Description</label>
                      <input
                        type="text"
                        placeholder="Join our central Discord server community and verify your node"
                        value={newMissionDescription}
                        onChange={(e) => setNewMissionDescription(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Type</label>
                        <select
                          value={newMissionType}
                          onChange={(e) => setNewMissionType(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        >
                          <option value="social">Social</option>
                          <option value="onboarding">Onboarding</option>
                          <option value="token">Token Holder</option>
                          <option value="daily">Daily Reset</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">XP Reward</label>
                        <input
                          type="number"
                          value={newMissionXp}
                          onChange={(e) => setNewMissionXp(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Verification</label>
                        <select
                          value={newMissionValType}
                          onChange={(e) => setNewMissionValType(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        >
                          <option value="auto">Auto Click</option>
                          <option value="visit">External URL Visit</option>
                          <option value="social">Social Confirm</option>
                          <option value="wallet">TON Wallet Connect</option>
                          <option value="verify_balance">Hold Margin</option>
                          <option value="verify_vault">Vault Stake</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-mono text-white/40 block mb-0.5">External URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://discord.gg/marg"
                        value={newMissionUrl}
                        onChange={(e) => setNewMissionUrl(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                      />
                    </div>

                    <button
                      onClick={handleAdminCreateMission}
                      className="w-full bg-emerald-990 hover:bg-emerald-900 border border-emerald-500/40 py-2 rounded text-emerald-300 font-mono text-xs cursor-pointer font-bold uppercase"
                    >
                      Save Mission Card
                    </button>
                    {newMissionMessage && <p className="text-[9px] font-mono text-emerald-400">{newMissionMessage}</p>}
                  </div>

                  {/* Admin create Custom Campaign */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-3">
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">create campaign distribution</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Campaign ID</label>
                        <input
                          type="text"
                          placeholder="marg_payout_2"
                          value={newCampId}
                          onChange={(e) => setNewCampId(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-mono text-white/40 block mb-0.5">Contest Prize Pool</label>
                        <input
                          type="text"
                          placeholder="300 TON"
                          value={newCampPool}
                          onChange={(e) => setNewCampPool(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-mono text-white/40 block mb-0.5">Campaign Title</label>
                      <input
                        type="text"
                        placeholder="Weekly Staking Champion"
                        value={newCampTitle}
                        onChange={(e) => setNewCampTitle(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded p-1.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[8px] font-mono text-white/40 block mb-0.5">Rules Statement</label>
                      <textarea
                        rows={3}
                        placeholder="1. Must have LVL 4 Raider status or higher&#10;2. Hold 1,000 active staked MARG in the Locker&#10;3. Apply entry."
                        value={newCampRules}
                        onChange={(e) => setNewCampRules(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded p-1.5 text-white font-mono text-[10px]"
                      />
                    </div>

                    <button
                      onClick={handleAdminCreateCampaign}
                      className="w-full bg-emerald-990 hover:bg-emerald-900 border border-emerald-500/30 py-2 rounded text-emerald-300 font-mono text-xs cursor-pointer font-bold uppercase"
                    >
                      Publish Campaign Pool
                    </button>
                    {newCampMessage && <p className="text-[9px] font-mono text-emerald-400">{newCampMessage}</p>}
                  </div>

                  {/* XP Grants Audit Trail Table Logs */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">Points Ledger Trail Audit</span>
                    <div className="mt-2.5 max-h-48 overflow-y-auto space-y-1.5 text-[10px] font-mono text-white/70">
                      {adminXpHistory.map((item, idx) => (
                        <div key={idx} className="p-1.5 bg-black/40 border border-white/5 rounded flex justify-between">
                          <div>
                            <span className="text-emerald-400">@{adminUsers.find(u => u.telegramId === item.user_id)?.username || item.user_id}</span>: {item.reason}
                          </div>
                          <div className="text-right font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#c084fc]">
                            +{item.amount} XP
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
