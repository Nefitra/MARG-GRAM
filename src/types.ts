/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HolderLevel = 'Starter' | 'Active' | 'Power' | 'Elite' | 'Whale';

export interface LevelInfo {
  level: HolderLevel;
  minPower: number;
  badgeColor: string;
  badgeGlow: string;
  description: string;
  benefits: string[];
}

export interface LockedPosition {
  amount: number;
  unlockDate: string;
  durationMonths: number;
  multiplier: number;
  powerYield: number;
  active: boolean;
}

export interface UserState {
  balance: number; // MARG tokens in wallet
  lockedBalance: number; // MARG locked
  holderPower: number; // calculated from held + locked * multiplier
  level: HolderLevel;
  totalRewardsClaimed: number;
  referralCount: number;
  referralPower: number;
  referralRank: string;
  mysteryBoxesOwned: number;
  openedBoxesCount: number;
  lastClaimDate: string | null; // ISO string
  locks: LockedPosition[];
  empireCreated: boolean;
  rank: number;
  claimedMilestones: number[];
}

export interface LeaderboardEntry {
  rank: number;
  userName: string;
  power: number;
  lockedAmount: number;
  level: HolderLevel;
  isCurrentUser?: boolean;
}

export interface ChartDataPoint {
  time: string;
  price: number;
  volume: number;
}
