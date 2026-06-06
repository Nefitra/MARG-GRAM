import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const PORT = 3000;
const app = express();
app.use(express.json());

// Load Firebase Config dynamically
let firebaseConfig: any;
let db: any;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
    console.log("Firebase Admin initialized successfully on server. DB ID:", firebaseConfig.firestoreDatabaseId);
  } else {
    console.error("CRITICAL: firebase-applet-config.json not found in root!");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

// Wrapper Compatibility Layer for Firebase Admin to mirror Firebase Client Web SDK API
class CompatDocumentSnapshot {
  _snap: any;
  constructor(snap: any) {
    this._snap = snap;
  }
  exists() {
    return this._snap.exists;
  }
  data() {
    return this._snap.data();
  }
  get id() {
    return this._snap.id;
  }
}

function doc(db: any, col: string, id: string) {
  return db.collection(col).doc(id);
}

async function setDoc(docRef: any, data: any) {
  return await docRef.set(data);
}

async function getDoc(docRef: any) {
  const snap = await docRef.get();
  return new CompatDocumentSnapshot(snap);
}

async function getDocs(queryRef: any) {
  const snap = await queryRef.get();
  return {
    forEach: (callback: (doc: any) => void) => {
      snap.forEach((d: any) => {
        callback(new CompatDocumentSnapshot(d));
      });
    },
    get docs() {
      return snap.docs.map((d: any) => new CompatDocumentSnapshot(d));
    }
  };
}

async function updateDoc(docRef: any, data: any) {
  return await docRef.update(data);
}

function collection(db: any, path: string) {
  return db.collection(path);
}

function where(field: string, op: any, val: any) {
  return (q: any) => q.where(field, op, val);
}

function orderBy(field: string, dir?: 'asc' | 'desc') {
  return (q: any) => q.orderBy(field, dir || 'asc');
}

function limit(num: number) {
  return (q: any) => q.limit(num);
}

function query(baseQuery: any, ...constraints: any[]) {
  let q = baseQuery;
  for (const constraint of constraints) {
    q = constraint(q);
  }
  return q;
}

async function addDoc(colRef: any, data: any) {
  return await colRef.add(data);
}


// Configurable multipliers & rules
const FORMULA_CONFIG = {
  powerPerMarg: 1,           // 1 MARG balance = 1 Base Power
  referralL1Bonus: 1500,     // Level 1 referral rewards +1500 Power
  referralL2Bonus: 500,      // Level 2 referral rewards +500 Power
  streakBonusMultiplier: 50, // Per streak day bonus points
};

const JETTON_MASTER_ADDRESS = process.env.MARG_JETTON_MASTER_ADDRESS || process.env.MARG_JETTON_MASTER_ADD || "EQDQcDUpJIFGwPZmeZUcZAAa-C8LB9-dhZxPfX-94l6asKL_";

// --- SECURITY LOGIC: TELEGRAM DATA INTEGRITY VERIFICATION ---
function verifyTelegramWebAppData(initData: string, botToken: string): { success: boolean; data?: any; error?: string; isSandbox: boolean } {
  if (!initData) return { success: false, error: "Empty init data", isSandbox: true };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const userString = params.get('user');

    if (!hash || !userString) {
      return { success: false, error: "Missing hash or user parameter", isSandbox: true };
    }

    // Support safe sandbox/mock preview sessions for web browser access or testing
    if (hash === "mock_demo_mode_hash") {
      const user = JSON.parse(userString);
      return { success: true, data: { user, startParam: params.get('start_param') || "" }, isSandbox: true };
    }

    if (!botToken) {
      // Allow sandbox validation if bot token is not configured on the server
      const user = JSON.parse(userString);
      return { success: true, data: { user, startParam: params.get('start_param') || "" }, isSandbox: true };
    }

    // Build data-check-string
    const keys = Array.from(params.keys()).filter(k => k !== 'hash').sort();
    const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n');

    // HMAC verification
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash === hash) {
      const user = JSON.parse(userString);
      return { success: true, data: { user, startParam: params.get('start_param') || "" }, isSandbox: false };
    }

    return { success: false, error: "Data integrity verification failed. Signatures mismatched.", isSandbox: false };
  } catch (err: any) {
    return { success: false, error: err.message || "Parsing collision occurred", isSandbox: true };
  }
}

// --- TON API JETTON BALANCE RETRIEVER ---
async function fetchMargBalance(walletAddress: string): Promise<number> {
  if (!walletAddress) return 0;
  try {
    // Standard TonAPI accounts balance fetch
    const response = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}/jettons`, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) {
      throw new Error(`TonAPI status error: ${response.status}`);
    }
    const data = await response.json();
    const balanceItem = data.balances?.find((b: any) => 
      b.jetton?.address?.toLowerCase() === JETTON_MASTER_ADDRESS.toLowerCase()
    );

    if (balanceItem) {
      const decimals = balanceItem.jetton?.decimals || 9;
      const rawBalance = parseFloat(balanceItem.balance);
      return rawBalance / Math.pow(10, decimals);
    }
    return 0;
  } catch (error) {
    console.error(`Error querying TON Jetton Balance for ${walletAddress}:`, error);
    return 0;
  }
}

// Helper to calculate total Holder Power with current multipliers & streaks
function calculateHolderStats(user: any, activeLocks: any[]) {
  const currentBalance = user.wallet_address ? (user.ton_marg_balance || 0) : (user.balance || 0);
  
  // Power from locks with active lock multipliers
  let totalLockPower = 0;
  let totalLockedAmount = 0;
  activeLocks.forEach((lock: any) => {
    if (lock.status === 'active') {
      totalLockedAmount += lock.amount;
      totalLockPower += Math.round(lock.amount * lock.multiplier);
    }
  });

  // Calculate invite network bonuses (Level 1 and Level 2)
  const l1Power = (user.referral_count_l1 || 0) * FORMULA_CONFIG.referralL1Bonus;
  const l2Power = (user.referral_count_l2 || 0) * FORMULA_CONFIG.referralL2Bonus;
  
  // Streak bonuses
  const streakBonus = (user.daily_streak || 1) * FORMULA_CONFIG.streakBonusMultiplier;

  // Base Equation
  const calculatedPower = Math.round(currentBalance + totalLockPower + l1Power + l2Power + streakBonus);

  // Power Tiers classification
  let level = 'Starter';
  if (calculatedPower >= 75000) level = 'Whale';
  else if (calculatedPower >= 25000) level = 'Elite';
  else if (calculatedPower >= 10000) level = 'Power';
  else if (calculatedPower >= 2500) level = 'Active';

  return {
    holderPower: calculatedPower,
    level,
    totalLockedAmount
  };
}

// --- FIRESTORE STANDARD ERROR HANDLER ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
function handleFirestoreError(error: any, op: OperationType, path: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType: op,
    path,
    authInfo: { system_bypass: true }
  };
  console.error("Firestore Error Captured:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- ENDPOINTS ---

// 1. Initialise Telegram Mini App Account and load profile
app.post('/api/user/init', async (req, res) => {
  const { initData, walletAddress } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  
  const verification = verifyTelegramWebAppData(initData, botToken);
  if (!verification.success) {
    return res.status(401).json({ error: verification.error });
  }

  const tgUser = verification.data.user;
  const startParam = verification.data.startParam; // e.g. "ref_12345"
  const userIdStr = String(tgUser.id);
  const isSandboxSession = verification.isSandbox === true;

  try {
    const userDocRef = doc(db, 'users', userIdStr);
    let userSnap;
    try {
      userSnap = await getDoc(userDocRef);
    } catch (e) {
      return handleFirestoreError(e, OperationType.GET, `users/${userIdStr}`);
    }

    let user: any;
    const nowISO = new Date().toISOString();

    if (!userSnap.exists()) {
      // First registration!
      // Generate unique random 6 characters referral code for user
      const uniqueRef = "MR" + Math.floor(100 + Math.random() * 900) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
      
      let referredBy = "";
      // Handle referral link parsing (ref_USERID)
      if (startParam && startParam.startsWith("ref_")) {
        const potentialReferrerId = startParam.substring(4).trim();
        // Prevent self referral
        if (potentialReferrerId !== userIdStr) {
          referredBy = potentialReferrerId;
        }
      }

      user = {
        id: userIdStr,
        telegram_user_id: userIdStr,
        username: tgUser.username || `user_${userIdStr}`,
        first_name: tgUser.first_name || "Sovereign Member",
        wallet_address: walletAddress || "",
        ton_marg_balance: 0,
        referral_code: uniqueRef,
        referred_by: referredBy,
        balance: 0, 
        locked_balance: 0,
        referral_count_l1: 0,
        referral_count_l2: 0,
        daily_streak: 1,
        last_claim_date: null,
        mystery_boxes_owned: 0,
        opened_boxes_count: 0,
        created_at: nowISO,
        last_login_at: nowISO
      };

      try {
        await setDoc(userDocRef, user);
      } catch (e) {
        return handleFirestoreError(e, OperationType.CREATE, `users/${userIdStr}`);
      }

      // If referred, handle referral tree linkage & point allocations
      if (referredBy) {
        // Level 1 Referrer
        const referrerDocRef = doc(db, 'users', referredBy);
        const referrerSnap = await getDoc(referrerDocRef);
        if (referrerSnap.exists()) {
          const rData = referrerSnap.data();
          const nextL1Count = (rData.referral_count_l1 || 0) + 1;
          await updateDoc(referrerDocRef, {
            referral_count_l1: nextL1Count
          });

          // Save Referral collection entry
          const refEntryId = `${referredBy}_${userIdStr}`;
          await setDoc(doc(db, 'referrals', refEntryId), {
            id: refEntryId,
            referrer_user_id: referredBy,
            referred_user_id: userIdStr,
            level: 1,
            created_at: nowISO,
            reward_status: 'claimed'
          });

          // Optional Level 2 Referrer (Who referred the referrer)
          if (rData.referred_by) {
            const referrerL2DocRef = doc(db, 'users', rData.referred_by);
            const refL2Snap = await getDoc(referrerL2DocRef);
            if (refL2Snap.exists()) {
              const nextL2Count = (refL2Snap.data().referral_count_l2 || 0) + 1;
              await updateDoc(referrerL2DocRef, {
                referral_count_l2: nextL2Count
              });

              const refL2EntryId = `${rData.referred_by}_${userIdStr}_l2`;
              await setDoc(doc(db, 'referrals', refL2EntryId), {
                id: refL2EntryId,
                referrer_user_id: rData.referred_by,
                referred_user_id: userIdStr,
                level: 2,
                created_at: nowISO,
                reward_status: 'claimed'
              });
            }
          }
        }
      }
    } else {
      user = userSnap.data();
      // Update last login
      await updateDoc(userDocRef, {
        last_login_at: nowISO
      });
      user.last_login_at = nowISO;
    }

    // Refresh live MARG Token jetton balance if wallet linked
    if (user.wallet_address) {
      const liveMargBal = await fetchMargBalance(user.wallet_address);
      await updateDoc(userDocRef, {
        ton_marg_balance: liveMargBal
      });
      user.ton_marg_balance = liveMargBal;
    }

    // Fetch user locks
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', userIdStr));
    const locksDocs = await getDocs(locksQuery);
    const locks: any[] = [];
    locksDocs.forEach((doc) => {
      locks.push(doc.data());
    });

    // Compute complete values
    const stats = calculateHolderStats(user, locks);

    // Save/update user's aggregated leaderboard details
    await setDoc(doc(db, 'leaderboard', userIdStr), {
      user_id: userIdStr,
      username: user.username,
      first_name: user.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      updated_at: nowISO
    });

    return res.json({
      success: true,
      user,
      locks,
      stats,
      isSandbox: isSandboxSession
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed user transaction" });
  }
});

// 2. Connect live TON wallet and scan balances
app.post('/api/user/connect-wallet', async (req, res) => {
  const { telegramUserId, walletAddress } = req.body;
  if (!telegramUserId || !walletAddress) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User account not found" });
    }

    // Fetch TON jettons
    const liveMargBalance = await fetchMargBalance(walletAddress);

    await updateDoc(userDocRef, {
      wallet_address: walletAddress,
      ton_marg_balance: liveMargBalance
    });

    // Reload entire details
    const refreshedSnap = await getDoc(userDocRef);
    const user = refreshedSnap.data();

    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locks: any[] = [];
    locksDocs.forEach((doc) => locks.push(doc.data()));

    const stats = calculateHolderStats(user, locks);

    // Sync leaderboard
    await setDoc(doc(db, 'leaderboard', telegramUserId), {
      user_id: telegramUserId,
      username: user!.username,
      first_name: user!.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      updated_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      user,
      locks,
      stats
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed wallet connection setup" });
  }
});

// 3. Complete Lock Commitment Position in vaults
app.post('/api/user/lock', async (req, res) => {
  const { telegramUserId, amount, durationMonths } = req.body;
  
  if (!telegramUserId || !amount || !durationMonths) {
    return res.status(400).json({ error: "Required parameters missing" });
  }

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User not found" });

    const user = userSnap.data();
    const currentLiquid = user.balance || 0;

    if (currentLiquid < amount) {
      return res.status(400).json({ error: "Insufficient liquid simulated balance to lock" });
    }

    // Calculate details
    const now = new Date();
    const unlockDate = new Date();
    unlockDate.setMonth(unlockDate.getMonth() + durationMonths);

    const multiplierMap: Record<number, number> = { 1: 1.2, 3: 1.8, 6: 2.5, 12: 4.8 };
    const mult = multiplierMap[durationMonths] || 1.0;

    const lockId = `lock_${telegramUserId}_${Date.now()}`;
    const newLock = {
      id: lockId,
      user_id: telegramUserId,
      wallet_address: user.wallet_address || "",
      amount: amount,
      duration_days: durationMonths * 30,
      multiplier: mult,
      start_date: now.toISOString(),
      unlock_date: unlockDate.toISOString(),
      status: 'active'
    };

    // Save Lock Document
    await setDoc(doc(db, 'locks', lockId), newLock);

    // Update User Balance
    await updateDoc(userDocRef, {
      balance: currentLiquid - amount,
      locked_balance: (user.locked_balance || 0) + amount
    });

    // Reload and response
    const reloadSnap = await getDoc(userDocRef);
    const updatedUser = reloadSnap.data();

    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    const stats = calculateHolderStats(updatedUser, locksList);

    // Sync leaderboard
    await setDoc(doc(db, 'leaderboard', telegramUserId), {
      user_id: telegramUserId,
      username: updatedUser!.username,
      first_name: updatedUser!.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      updated_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      user: updatedUser,
      locks: locksList,
      stats
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 4. Claim Daily Drops (Cooldown Enforcement)
app.post('/api/user/claim-daily', async (req, res) => {
  const { telegramUserId } = req.body;
  if (!telegramUserId) return res.status(400).json({ error: "Missing identity parameter" });

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User profile missing" });

    const user = userSnap.data();
    const now = new Date();
    
    if (user.last_claim_date) {
      const lastClaimTime = new Date(user.last_claim_date).getTime();
      const differenceMs = now.getTime() - lastClaimTime;
      const cooldownMs = 24 * 60 * 60 * 1000;
      if (differenceMs < cooldownMs) {
        const remainingHours = ((cooldownMs - differenceMs) / (1000 * 60 * 60)).toFixed(1);
        return res.status(400).json({ error: `Daily drops cooling down. Re-charge in ${remainingHours} hours.` });
      }
    }

    const rewardCoins = 1500;
    const currentStreak = user.daily_streak || 1;
    let nextStreak = currentStreak + 1;
    
    // Check if streak is broken (e.g. over 48 hours elapsed)
    if (user.last_claim_date) {
      const lastClaimTime = new Date(user.last_claim_date).getTime();
      const differenceMs = now.getTime() - lastClaimTime;
      if (differenceMs > 48 * 60 * 60 * 1000) {
        nextStreak = 1; // broken streak
      }
    }

    const nowISO = now.toISOString();
    await updateDoc(userDocRef, {
      balance: (user.balance || 0) + rewardCoins,
      last_claim_date: nowISO,
      daily_streak: nextStreak
    });

    // Record Reward Collection
    const rewardId = `reward_${telegramUserId}_${Date.now()}`;
    await setDoc(doc(db, 'rewards', rewardId), {
      id: rewardId,
      user_id: telegramUserId,
      reward_type: 'daily',
      amount: rewardCoins,
      status: 'claimed',
      created_at: nowISO
    });

    // Reload stats
    const reloadSnap = await getDoc(userDocRef);
    const updatedUser = reloadSnap.data();

    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    const stats = calculateHolderStats(updatedUser, locksList);

    return res.json({
      success: true,
      user: updatedUser,
      locks: locksList,
      stats,
      rewardClaimed: rewardCoins
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 5. Open Mystery Boxes
app.post('/api/user/mystery-box/open', async (req, res) => {
  const { telegramUserId, specialOpen } = req.body;
  if (!telegramUserId) return res.status(400).json({ error: "Missing parameter" });

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User missing" });

    const user = userSnap.data();
    const boxes = user.mystery_boxes_owned || 0;

    if (boxes <= 0) {
      return res.status(400).json({ error: "No orbital mystery containers currently owned." });
    }

    // Roll prizes randomly
    let prizeAmount = 0;
    let prizeType = "balance";
    const roll = Math.random();

    if (specialOpen) {
      // High weight on stable coefficient multipliers (represented as permanent stats)
      prizeAmount = Math.floor(2500 + Math.random() * 5000);
      prizeType = "power_gained";
    } else {
      if (roll <= 0.6) {
        prizeAmount = Math.floor(500 + Math.random() * 1000); // 500 - 1500 MARG tokens
        prizeType = "balance";
      } else {
        prizeAmount = Math.floor(1000 + Math.random() * 2000); // 1000 - 3000 boost
        prizeType = "power_gained";
      }
    }

    const updates: any = {
      mystery_boxes_owned: boxes - 1,
      opened_boxes_count: (user.opened_boxes_count || 0) + 1
    };

    if (prizeType === "balance") {
      updates.balance = (user.balance || 0) + prizeAmount;
    } else {
      // Accumulate into a special permanent profile multiplier boost
      updates.multiplier_points_boost = (user.multiplier_points_boost || 0) + prizeAmount;
    }

    await updateDoc(userDocRef, updates);

    // Save Reward Record
    const rewardId = `box_${telegramUserId}_${Date.now()}`;
    await setDoc(doc(db, 'rewards', rewardId), {
      id: rewardId,
      user_id: telegramUserId,
      reward_type: 'mystery_box',
      amount: prizeAmount,
      status: 'claimed',
      created_at: new Date().toISOString()
    });

    const reloadSnap = await getDoc(userDocRef);
    const updatedUser = reloadSnap.data();

    // Recalculate
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    // Adjust calculation list with mystery boost added directly to power
    const stats = calculateHolderStats(updatedUser, locksList);
    // Add custom multiplier boost points
    stats.holderPower += (updatedUser!.multiplier_points_boost || 0);

    return res.json({
      success: true,
      user: updatedUser,
      stats,
      locks: locksList,
      prizeAmount,
      prizeType
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 6. Buy Mystery Boxes
app.post('/api/user/mystery-box/buy', async (req, res) => {
  const { telegramUserId, count } = req.body;
  if (!telegramUserId || !count) return res.status(400).json({ error: "Parameters missing" });

  const costPerBox = 1000;
  const totalCost = costPerBox * count;

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User missing" });

    const user = userSnap.data();
    const liquid = user.balance || 0;

    if (liquid < totalCost) {
      return res.status(400).json({ error: `Insufficient simulated credits. Needs ${totalCost} MARG.` });
    }

    await updateDoc(userDocRef, {
      balance: liquid - totalCost,
      mystery_boxes_owned: (user.mystery_boxes_owned || 0) + count
    });

    const reloadSnap = await getDoc(userDocRef);
    const updatedUser = reloadSnap.data();

    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    const stats = calculateHolderStats(updatedUser, locksList);
    stats.holderPower += (updatedUser!.multiplier_points_boost || 0);

    return res.json({
      success: true,
      user: updatedUser,
      stats,
      locks: locksList
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 7. Dynamic Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  const { type } = req.query; // 'holders' | 'lockers' | 'referrers'
  
  try {
    const lbCollectionRef = collection(db, 'leaderboard');
    let q;

    if (type === 'lockers') {
      q = query(lbCollectionRef, orderBy('locked_amount', 'desc'), limit(15));
    } else {
      q = query(lbCollectionRef, orderBy('holder_power', 'desc'), limit(15));
    }

    const snap = await getDocs(q);
    const userEntries: any[] = [];
    
    snap.forEach((doc) => {
      const data: any = doc.data();
      userEntries.push({
        userName: data.username ? (data.username.startsWith('@') ? data.username : `@${data.username}`) : "Sovereign Member",
        power: data.holder_power || 0,
        lockedAmount: data.locked_amount || 0,
        level: data.level || "Starter",
        userId: data.user_id
      });
    });

    // Seed realistic global community members to fill the Hall of Legends with active participants
    const dummyComm = [
      { userName: "@ton_emperor", power: 125400, lockedAmount: 75000, level: "Whale" },
      { userName: "@cyber_phantom", power: 88500, lockedAmount: 50000, level: "Whale" },
      { userName: "@defi_juggernaut", power: 67200, lockedAmount: 35000, level: "Elite" },
      { userName: "@marg_prophet", power: 54100, lockedAmount: 25000, level: "Elite" },
      { userName: "@ton_titan", power: 41900, lockedAmount: 20000, level: "Elite" },
      { userName: "@solitary_whale", power: 31200, lockedAmount: 15000, level: "Elite" },
      { userName: "@genesis_miner", power: 22400, lockedAmount: 10000, level: "Power" },
      { userName: "@web3_sentry", power: 15900, lockedAmount: 8000, level: "Power" },
      { userName: "@lock_sovereign", power: 11200, lockedAmount: 5000, level: "Power" },
      { userName: "@alpha_commander", power: 8400, lockedAmount: 4000, level: "Active" },
      { userName: "@cyber_ranger", power: 4600, lockedAmount: 2000, level: "Active" },
      { userName: "@ton_scout", power: 1800, lockedAmount: 800, level: "Starter" },
      { userName: "@blockchain_novice", power: 450, lockedAmount: 100, level: "Starter" }
    ];

    // Filter out dummy members that have the exact same name as any existing real db users
    const filteredDummy = dummyComm.filter(
      dc => !userEntries.some(ue => ue.userName.toLowerCase() === dc.userName.toLowerCase())
    );
    
    // Combine
    let combined = [...userEntries, ...filteredDummy];

    // Sort depending on section filter
    if (type === 'lockers') {
      combined.sort((a, b) => b.lockedAmount - a.lockedAmount);
    } else if (type === 'referrers') {
      combined.sort((a, b) => b.power - a.power);
    } else {
      combined.sort((a, b) => b.power - a.power);
    }

    // Assign final ranks
    const rankings = combined.map((entry, index) => ({
      rank: index + 1,
      userName: entry.userName,
      power: entry.power,
      lockedAmount: entry.lockedAmount,
      level: entry.level,
      isCurrentUser: entry.userId ? true : false
    }));

    return res.json({
      success: true,
      rankings: rankings.slice(0, 15)
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 7.5. Claim Milestone Gift API
app.post('/api/user/claim-milestone', async (req, res) => {
  const { telegramUserId, milestonePower, margReward, boxesReward } = req.body;
  if (!telegramUserId || !milestonePower) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const userDocRef = doc(db, 'users', String(telegramUserId));
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userSnap.data();
    const claimed = user.claimed_milestones || [];

    if (claimed.includes(Number(milestonePower))) {
      return res.status(400).json({ error: "Milestone already claimed" });
    }

    const updatedClaimed = [...claimed, Number(milestonePower)];
    const nextBalance = (user.balance || 0) + Number(margReward);
    const nextBoxes = (user.mystery_boxes_owned || 0) + Number(boxesReward);

    const updatePayload: any = {
      claimed_milestones: updatedClaimed,
      balance: nextBalance,
      mystery_boxes_owned: nextBoxes
    };

    // If wallet linked, sync ton_marg_balance
    if (user.wallet_address) {
      updatePayload.ton_marg_balance = (user.ton_marg_balance || 0) + Number(margReward);
    }

    await updateDoc(userDocRef, updatePayload);

    // Recompute User Power
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', String(telegramUserId)));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    const updatedUser = { ...user, ...updatePayload };
    const stats = calculateHolderStats(updatedUser, locksList);

    // Sync leaderboard details
    await setDoc(doc(db, 'leaderboard', String(telegramUserId)), {
      user_id: String(telegramUserId),
      username: user.username,
      first_name: user.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      updated_at: new Date().toISOString()
    });

    return res.json({
      success: true,
      user: updatedUser,
      stats
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// 8. Admin-Only Force State Snapshot Logging Action
app.post('/api/admin/snapshot', async (req, res) => {
  // Production admin action
  const { adminSecret } = req.body;
  // A simple mechanism checking a custom configured secret or verifying standard authorization
  if (adminSecret !== "MARG_ADMIN_SECURE_TOKEN_5588") {
    return res.status(403).json({ error: "Access denied. Sovereign secret is invalid." });
  }

  try {
    const usersQuery = collection(db, 'users');
    const userDocs = await getDocs(usersQuery);
    
    let snapshotsCommitted = 0;
    const nowISO = new Date().toISOString();

    for (const uDoc of userDocs.docs) {
      const user = uDoc.data();
      const userId = user.id;

      const locksQuery = query(collection(db, 'locks'), where('user_id', '==', userId));
      const locksDocs = await getDocs(locksQuery);
      const locksList: any[] = [];
      locksDocs.forEach((d) => locksList.push(d.data()));

      const stats = calculateHolderStats(user, locksList);
      stats.holderPower += (user.multiplier_points_boost || 0);

      const snapshotId = `snapshot_${userId}_${Date.now()}`;
      await setDoc(doc(db, 'wallet_snapshots', snapshotId), {
        id: snapshotId,
        user_id: userId,
        wallet_address: user.wallet_address || "",
        marg_balance: user.wallet_address ? (user.ton_marg_balance || 0) : (user.balance || 0),
        holder_level: stats.level,
        holder_power: stats.holderPower,
        created_at: nowISO
      });
      snapshotsCommitted++;
    }

    return res.json({
      success: true,
      message: `Successfully generated security and points snapshot for ${snapshotsCommitted} active users network-wide.`,
      timestamp: nowISO
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});


// Serve tonconnect-manifest.json
app.get('/tonconnect-manifest.json', (req, res) => {
  const manifestPath = path.join(process.cwd(), 'assets', 'tonconnect-manifest.json');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(manifestPath);
  } else {
    res.status(404).json({ error: "manifest not found" });
  }
});

// Boostrap Async Block for web server serving
async function startBootstrap() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProductionBuild = fs.existsSync(path.join(distPath, 'index.html'));

  console.log(`[BOOTSTRAP] Check path: ${distPath}. Build exists: ${isProductionBuild}`);

  if (isProductionBuild || process.env.NODE_ENV === "production") {
    console.log(`[BOOTSTRAP] Launching static fileserver from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log("[BOOTSTRAP] Falling back to development Vite dev server dynamically");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Start Listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MARG SERVER] Server is securely running at http://localhost:${PORT}`);
  });
}

startBootstrap();
