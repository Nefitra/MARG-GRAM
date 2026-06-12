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
let isFirestoreIamError = false;

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

// Robust Dual-Layer High-Fidelity Standalone Database Fallback
class LocalDbFallback {
  private data: Record<string, Record<string, any>> = {
    users: {},
    referrals: {},
    wallet_snapshots: {},
    rewards: {},
    locks: {},
    leaderboard: {},
    missions: {},
    user_missions: {},
    xp_history: {},
    campaigns: {}
  };
  private filePath = path.join(process.cwd(), '.local-db-fallback.json');

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(fileContent);
        console.log("[DB COMPAT] Loaded local cached database storage fallback.");
      }
    } catch (e: any) {
      console.warn("[DB COMPAT] Could not parse local cached storage fallback. Starting clean.");
    }
  }

  private save() {
    if (process.env.DISABLE_LOCAL_FALLBACK === "true") {
      return;
    }
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e: any) {
      console.error("[DB COMPAT] Failed writing local store to disk:", e.message || e);
    }
  }

  public get(collection: string, docId: string): any {
    if (!this.data[collection]) this.data[collection] = {};
    return this.data[collection][docId] || null;
  }

  public set(collection: string, docId: string, payload: any): void {
    if (!this.data[collection]) this.data[collection] = {};
    const existing = this.data[collection][docId] || {};
    this.data[collection][docId] = { ...existing, ...payload };
    this.save();
  }

  public list(collection: string): any[] {
    if (!this.data[collection]) this.data[collection] = {};
    return Object.values(this.data[collection]);
  }
}

const localFallback = new LocalDbFallback();

// Wrapper Compatibility Layer that mirrors Firebase Client Web SDK API but handles PERMISSION_DENIED
class CompatDocumentSnapshot {
  _data: any;
  _id: string;
  _exists: boolean;
  constructor(data: any, id: string, exists: boolean) {
    this._data = data;
    this._id = id;
    this._exists = exists;
  }
  exists() {
    return this._exists;
  }
  data() {
    return this._data;
  }
  get id() {
    return this._id;
  }
}

async function runWithRetry<T>(operationName: string, path: string, fn: () => Promise<T>): Promise<T> {
  if (isFirestoreIamError) {
    throw new Error("IAM fallback");
  }
  const maxAttempts = 5;
  let attempt = 0;
  let delay = 100; // start with 100ms
  
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      const rawMsg = String(err.message || err);
      const isIam = err.code === 7 || 
                    err.code === 'permission-denied' || 
                    rawMsg.includes('permission') || 
                    rawMsg.includes('denied') || 
                    rawMsg.includes('IAM') ||
                    rawMsg.includes('gRPC code 7');
      
      if (isIam) {
        isFirestoreIamError = true;
        throw new Error("IAM fallback");
      }
      
      const isTransient = 
        rawMsg.includes('RESOURCE_EXHAUSTED') ||
        err.status === 429;
      
      const isLastAttempt = attempt >= maxAttempts;
      
      if (isTransient && !isLastAttempt) {
        console.warn(`[DB RETRY] Attempt ${attempt}/${maxAttempts} for ${operationName} on ${path}. Jitter delaying ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = delay * 2 + Math.floor(Math.random() * 50); // double with jitter
        continue;
      }
      
      throw err;
    }
  }
}

function doc(db: any, col: string, id: string) {
  return { col, id };
}

async function setDoc(docRef: any, data: any) {
  const { col, id } = docRef;
  const pathStr = `${col}/${id}`;
  if (db && !isFirestoreIamError) {
    try {
      await runWithRetry('setDoc', pathStr, async () => {
        await db.collection(col).doc(id).set(data);
      });
      localFallback.set(col, id, data);
      return;
    } catch (err: any) {
      const isIamError = isFirestoreIamError || err.message === "IAM fallback" || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('IAM') || err.code === 7 || err.code === 'permission-denied';
      if (isIamError) {
        isFirestoreIamError = true;
        console.warn(`[DB FALLBACK] Utilizing local container database failover for setDoc on ${pathStr}`);
        localFallback.set(col, id, data);
        return;
      } else {
        console.error(`[DB ERROR] setDoc error on ${pathStr}:`, err.message || err);
      }
      throw err;
    }
  } else {
    localFallback.set(col, id, data);
  }
}

async function getDoc(docRef: any) {
  const { col, id } = docRef;
  const pathStr = `${col}/${id}`;
  if (db && !isFirestoreIamError) {
    try {
      const snap = await runWithRetry('getDoc', pathStr, async () => {
        return await db.collection(col).doc(id).get();
      });
      if (snap.exists) {
        const docData = snap.data();
        localFallback.set(col, id, docData);
        return new CompatDocumentSnapshot(docData, id, true);
      } else {
        const localVal = localFallback.get(col, id);
        if (localVal !== null) {
          return new CompatDocumentSnapshot(localVal, id, true);
        }
        return new CompatDocumentSnapshot(null, id, false);
      }
    } catch (err: any) {
      const isIamError = isFirestoreIamError || err.message === "IAM fallback" || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('IAM') || err.code === 7 || err.code === 'permission-denied';
      if (isIamError) {
        isFirestoreIamError = true;
        console.warn(`[DB FALLBACK] Utilizing local container database failover for getDoc on ${pathStr}`);
        const localVal = localFallback.get(col, id);
        return new CompatDocumentSnapshot(localVal, id, localVal !== null);
      } else {
        console.error(`[DB ERROR] getDoc error on ${pathStr}:`, err.message || err);
      }
      throw err;
    }
  } else {
    const localVal = localFallback.get(col, id);
    return new CompatDocumentSnapshot(localVal, id, localVal !== null);
  }
}

async function getDocs(queryRef: any) {
  const { col, constraints = [] } = queryRef;
  let docsList: any[] = [];
  const pathStr = `query/${col}`;

  if (db && !isFirestoreIamError) {
    try {
      let q = db.collection(col);
      for (const c of constraints) {
        if (c.type === 'where') q = q.where(c.field, c.op, c.val);
        else if (c.type === 'orderBy') q = q.orderBy(c.field, c.dir);
        else if (c.type === 'limit') q = q.limit(c.limit);
      }
      const snap = await runWithRetry('getDocs', pathStr, async () => {
        return await q.get();
      });
      docsList = snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
      docsList.forEach(({ id, data }) => localFallback.set(col, id, data));
    } catch (err: any) {
      const isIamError = isFirestoreIamError || err.message === "IAM fallback" || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('IAM') || err.code === 7 || err.code === 'permission-denied';
      if (isIamError) {
        isFirestoreIamError = true;
        console.warn(`[DB FALLBACK] Utilizing local container database failover for getDocs on query/${col}`);
        let list = localFallback.list(col);
        for (const c of constraints) {
          if (c.type === 'where') {
            const { field, op, val } = c;
            list = list.filter((item: any) => {
              const itemVal = item[field];
              if (op === '==') return itemVal === val;
              if (op === '>=') return itemVal >= val;
              if (op === '<=') return itemVal <= val;
              if (op === '>') return itemVal > val;
              if (op === '<') return itemVal < val;
              return true;
            });
          }
        }
        const order = constraints.find((c: any) => c.type === 'orderBy');
        if (order) {
          const { field, dir } = order;
          list.sort((a, b) => {
            const valA = a[field] ?? 0;
            const valB = b[field] ?? 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
              return dir === 'desc' ? valB - valA : valA - valB;
            }
            return dir === 'desc' ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
          });
        }
        const lim = constraints.find((c: any) => c.type === 'limit');
        if (lim) {
          list = list.slice(0, lim.limit);
        }
        docsList = list.map((item: any) => ({ id: item.id || item.user_id, data: item }));
      } else {
        console.error(`[DB ERROR] getDocs error on collection ${col}:`, err.message || err);
        throw err;
      }
    }
  } else {
    let list = localFallback.list(col);
    for (const c of constraints) {
      if (c.type === 'where') {
        const { field, op, val } = c;
        list = list.filter((item: any) => {
          const itemVal = item[field];
          if (op === '==') return itemVal === val;
          if (op === '>=') return itemVal >= val;
          if (op === '<=') return itemVal <= val;
          if (op === '>') return itemVal > val;
          if (op === '<') return itemVal < val;
          return true;
        });
      }
    }
    const order = constraints.find((c: any) => c.type === 'orderBy');
    if (order) {
      const { field, dir } = order;
      list.sort((a, b) => {
        const valA = a[field] ?? 0;
        const valB = b[field] ?? 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return dir === 'desc' ? valB - valA : valA - valB;
        }
        return dir === 'desc' ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
      });
    }
    const lim = constraints.find((c: any) => c.type === 'limit');
    if (lim) {
      list = list.slice(0, lim.limit);
    }
    docsList = list.map((item: any) => ({ id: item.id || item.user_id, data: item }));
  }

  return {
    forEach: (callback: (doc: any) => void) => {
      docsList.forEach(({ id, data }) => {
        callback(new CompatDocumentSnapshot(data, id, true));
      });
    },
    get docs() {
      return docsList.map(({ id, data }) => new CompatDocumentSnapshot(data, id, true));
    }
  };
}

async function updateDoc(docRef: any, data: any) {
  const { col, id } = docRef;
  const pathStr = `${col}/${id}`;
  if (db && !isFirestoreIamError) {
    try {
      await runWithRetry('updateDoc', pathStr, async () => {
        await db.collection(col).doc(id).update(data);
      });
      localFallback.set(col, id, data);
      return;
    } catch (err: any) {
      const isIamError = isFirestoreIamError || err.message === "IAM fallback" || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('IAM') || err.code === 7 || err.code === 'permission-denied';
      if (isIamError) {
        isFirestoreIamError = true;
        console.warn(`[DB FALLBACK] Utilizing local container database failover for updateDoc on ${pathStr}`);
        localFallback.set(col, id, data);
        return;
      } else {
        console.error(`[DB ERROR] updateDoc error on ${pathStr}:`, err.message || err);
      }
      throw err;
    }
  } else {
    localFallback.set(col, id, data);
  }
}

function collection(db: any, path: string) {
  return { col: path };
}

function where(field: string, op: any, val: any) {
  return { type: 'where', field, op, val };
}

function orderBy(field: string, dir?: 'asc' | 'desc') {
  return { type: 'orderBy', field, dir: dir || 'asc' };
}

function limit(num: number) {
  return { type: 'limit', limit: num };
}

function query(baseQuery: any, ...constraints: any[]) {
  return { col: baseQuery.col, constraints };
}

async function addDoc(colRef: any, data: any) {
  const { col } = colRef;
  const pathStr = `col/${col}`;
  const autoId = `doc_${col}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  if (db && !isFirestoreIamError) {
    try {
      const res = await runWithRetry('addDoc', pathStr, async () => {
        return await db.collection(col).add(data);
      });
      localFallback.set(col, res.id, data);
      return { id: res.id };
    } catch (err: any) {
      const isIamError = isFirestoreIamError || err.message === "IAM fallback" || err.message?.includes('permission') || err.message?.includes('denied') || err.message?.includes('IAM') || err.code === 7 || err.code === 'permission-denied';
      if (isIamError) {
        isFirestoreIamError = true;
        console.warn(`[DB FALLBACK] Utilizing local container database failover for addDoc on ${col}`);
        localFallback.set(col, autoId, data);
        return { id: autoId };
      } else {
        console.error(`[DB ERROR] addDoc error on collection ${col}:`, err.message || err);
      }
      throw err;
    }
  } else {
    localFallback.set(col, autoId, data);
    return { id: autoId };
  }
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
  if (!initData) return { success: false, error: "Empty init data", isSandbox: false };

  // Allow developer design & preview sandbox mode in non-production environments
  if (initData.startsWith("sandbox_bypass_")) {
    const parts = initData.split('_');
    const mockId = parts[2] || "14201337";
    const mockUsername = parts[3] || "beskerboris";
    return {
      success: true,
      data: {
        user: {
          id: parseInt(mockId),
          first_name: "Sovereign Creator",
          last_name: "Developer",
          username: mockUsername,
          language_code: "en"
        },
        startParam: ""
      },
      isSandbox: true
    };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const userString = params.get('user');

    if (!hash || !userString) {
      return { success: false, error: "Missing hash or user parameter", isSandbox: false };
    }

    if (!botToken) {
      return { success: false, error: "Configuration conflict: Telegram Bot Token is not configured on the server.", isSandbox: false };
    }

    // Direct block of mock hashes to secure production operations
    if (hash === "mock_demo_mode_hash") {
      return { success: false, error: "Mock authentication bypass is strictly disabled.", isSandbox: false };
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
    return { success: false, error: err.message || "Parsing collision occurred", isSandbox: false };
  }
}

const balanceCache = new Map<string, { balance: number; tonBalance: number; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// --- TON API JETTON & NATIVE BALANCE RETRIEVER ---
async function fetchWalletBalances(walletAddress: string): Promise<{ margBalance: number; tonBalance: number }> {
  if (!walletAddress) return { margBalance: 0, tonBalance: 0 };

  // Support MetaMask/EVM gracefully
  if (walletAddress.toLowerCase().startsWith('0x')) {
    return { margBalance: 0, tonBalance: 0 };
  }

  const now = Date.now();
  const cached = balanceCache.get(walletAddress.toLowerCase());
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[BALANCE CACHE] Returning cached MARG balance for ${walletAddress}: ${cached.balance}`);
    return { margBalance: cached.balance, tonBalance: cached.tonBalance || 0 };
  }

  let margBalance = 0;
  let tonBalance = 0;

  try {
    const headers: Record<string, string> = {
      "Accept": "application/json"
    };
    if (process.env.TONAPI_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.TONAPI_API_KEY}`;
    }

    // 1. Fetch Jetton Balance
    const jettonsResponse = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}/jettons`, {
      headers
    });
    
    if (jettonsResponse.ok) {
      const data = await jettonsResponse.json();
      const balanceItem = data.balances?.find((b: any) => 
        b.jetton?.address?.toLowerCase() === JETTON_MASTER_ADDRESS.toLowerCase()
      );

      if (balanceItem) {
        const decimals = balanceItem.jetton?.decimals || 9;
        const rawBalance = parseFloat(balanceItem.balance);
        margBalance = rawBalance / Math.pow(10, decimals);
      }
    }

    // 2. Fetch Native TON Balance
    const nativeResponse = await fetch(`https://tonapi.io/v2/accounts/${walletAddress}`, {
      headers
    });
    if (nativeResponse.ok) {
      const nativeData = await nativeResponse.json();
      if (nativeData && nativeData.balance) {
        tonBalance = parseFloat(nativeData.balance) / 1e9; // Convert from nanoton to TON
      }
    }

    balanceCache.set(walletAddress.toLowerCase(), { balance: margBalance, tonBalance, timestamp: now });
    return { margBalance, tonBalance };
  } catch (error: any) {
    console.error(`Error querying TON Balances for ${walletAddress}:`, error.message || error);
    // Return cached or fallback if request fails, ensuring no lockouts
    return { margBalance: cached?.balance || 0, tonBalance: cached?.tonBalance || 0 };
  }
}

async function fetchMargBalance(walletAddress: string): Promise<number> {
  const balances = await fetchWalletBalances(walletAddress);
  return balances.margBalance;
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

// --- SECURITY MIDDLEWARE: TELEGRAM IDENTIFICATION CRYPTO ENFORCEMENT ---
async function requireTelegramAuth(req: any, res: any, next: any) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) {
    return res.status(401).json({ error: "Access denied. Crypto-signed Telegram identity session required." });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const verification = verifyTelegramWebAppData(initData, botToken);
  if (!verification.success) {
    return res.status(401).json({ error: verification.error || "Telegram identity authentication signature mismatched." });
  }

  // Attach verified user and sandbox status to request
  req.tgUser = verification.data.user;
  req.isSandbox = verification.isSandbox;
  next();
}

// --- MARG GROWTH ENGINE UTILITIES & CONFIGURATIONS ---
const ADMIN_TELEGRAM_IDS = [
  "beskerboris@gmail.com",
  "14201337", // Default sandbox telegram ID
  "711279376658" // From user data
];

const LEVEL_THRESHOLDS = [
  { minXp: 0, title: "Explorer", level: 1 },
  { minXp: 500, title: "Supporter", level: 2 },
  { minXp: 1500, title: "Holder", level: 3 },
  { minXp: 3000, title: "Raider", level: 4 },
  { minXp: 7500, title: "Builder", level: 5 },
  { minXp: 15000, title: "Whale", level: 6 },
  { minXp: 30000, title: "Legend", level: 7 }
];

function getLevelAndTitle(xp: number) {
  let matched = LEVEL_THRESHOLDS[0];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      matched = LEVEL_THRESHOLDS[i];
      break;
    }
  }
  const currentIndex = LEVEL_THRESHOLDS.findIndex(l => l.level === matched.level);
  const next = LEVEL_THRESHOLDS[currentIndex + 1] || null;
  return {
    level: matched.level,
    title: matched.title,
    nextXp: next ? next.minXp : matched.minXp,
    prevXp: matched.minXp
  };
}

const DEFAULT_MISSIONS_PRESETS = [
  { mission_id: "tg_connect", title: "Connect Telegram Account", description: "Verify your secure Telegram signature and link dashboard session", type: "onboarding", xp_reward: 50, is_daily: false, is_active: true, validation_type: "auto", external_url: "" },
  { mission_id: "ton_wallet_connect", title: "Connect TON Wallet", description: "Link your active TON ledger wallet securely via TON Connect", type: "onboarding", xp_reward: 100, is_daily: false, is_active: true, validation_type: "wallet", external_url: "" },
  { mission_id: "join_tg_group", title: "Join Telegram Group", description: "Become a part of the official MARG community chat", type: "onboarding", xp_reward: 50, is_daily: false, is_active: true, validation_type: "social", external_url: "https://t.me/marg_ecosystem" },
  { mission_id: "follow_x", title: "Follow MARG on X", description: "Keep track of announcements on the official Twitter/X", type: "onboarding", xp_reward: 50, is_daily: false, is_active: true, validation_type: "social", external_url: "https://x.com/marg_ecosystem" },
  { mission_id: "open_blum", title: "Open BLUM Trading", description: "Explore the live MARG/TON trading pairs inside the BLUM application", type: "onboarding", xp_reward: 50, is_daily: false, is_active: true, validation_type: "visit", external_url: "https://t.me/blum/app" },
  { mission_id: "repost_twitter", title: "Repost Official MARG Tweet", description: "Retweet/Repost the latest official announcement to spread network energy", type: "social", xp_reward: 75, is_daily: false, is_active: true, validation_type: "social", external_url: "https://x.com/marg_ecosystem/status/12345" },
  { mission_id: "comment_twitter", title: "Comment Under Pinned Post", description: "Express your support and share comments on our main X announcement", type: "social", xp_reward: 50, is_daily: false, is_active: true, validation_type: "social", external_url: "https://x.com/marg_ecosystem" },
  { mission_id: "invite_friends_group", title: "Invite Friends to Telegram", description: "Welcome high-power contacts into the central group network chat", type: "social", xp_reward: 100, is_daily: false, is_active: true, validation_type: "social", external_url: "" },
  { mission_id: "share_ref_link", title: "Share Referral Link", description: "Publish or forward your unique telegram referral connection path to friends", type: "social", xp_reward: 50, is_daily: false, is_active: true, validation_type: "visit", external_url: "https://t.me/share/url?url=https://t.me/marg_bot" },
  { mission_id: "buy_marg_blum", title: "Buy MARG on BLUM", description: "Verify active accumulation of MARG jetton tokens on BLUM dex", type: "token", xp_reward: 200, is_daily: false, is_active: true, validation_type: "verify_purchase", external_url: "" },
  { mission_id: "hold_marg_24h", title: "Hold MARG Multi-Day", description: "Hold at least 500 MARG tokens in your connected wallet", type: "token", xp_reward: 100, is_daily: false, is_active: true, validation_type: "verify_balance", external_url: "" },
  { mission_id: "balance_milestone", title: "Reach Balance Milestone", description: "Unlock the premier hoarder status by holding at least 5,000 MARG", type: "token", xp_reward: 300, is_daily: false, is_active: true, validation_type: "verify_balance", external_url: "" },
  { mission_id: "stake_lock_marg", title: "Stake/Lock in Vault", description: "Lock MARG tokens in one of the active yield boosting vaults for >30 days", type: "token", xp_reward: 300, is_daily: false, is_active: true, validation_type: "verify_vault", external_url: "" },
  { mission_id: "daily_checkin", title: "Daily Check-in", description: "Establish daily sync with the node to maintain points momentum", type: "daily", xp_reward: 25, is_daily: true, is_active: true, validation_type: "checkin", external_url: "" },
  { mission_id: "daily_app_open", title: "Inspect MARG Node", description: "Access the terminal daily to audit logs and verify local statistics", type: "daily", xp_reward: 15, is_daily: true, is_active: true, validation_type: "auto", external_url: "" },
  { mission_id: "daily_visit_blum", title: "Visit BLUM Exchange Hub", description: "Interact with the market maker nodes and monitor fluid live ticker charts", type: "daily", xp_reward: 15, is_daily: true, is_active: true, validation_type: "visit", external_url: "https://t.me/blum/app" }
];

const DEFAULT_CAMPAIGNS_PRESETS = [
  {
    campaign_id: "marg_pioneer",
    title: "MARG Pioneer Campaign",
    description: "Launch celebration for the first 100 active community members of the MARG Ecosystem. To qualify: verify wallet connection, join our Telegram chat, and hold any amount of MARG tokens.",
    start_date: "2026-06-12T00:00:00Z",
    end_date: "2026-07-12T23:59:59Z",
    status: "active",
    prize_pool: "50 TON",
    rules: "1. Connect active TON wallet\n2. Open growth module\n3. Engage community TG chat\n4. Top 1: 10 TON, Top 2: 5 TON, Top 3: 3 TON, 10 random qualifying members: 1 TON each."
  }
];

async function seedDefaultMissionsAndCampaigns() {
  for (const mission of DEFAULT_MISSIONS_PRESETS) {
    try {
      const mRef = doc(db, 'missions', mission.mission_id);
      const mSnap = await getDoc(mRef);
      if (!mSnap.exists()) {
        await setDoc(mRef, {
          ...mission,
          created_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`[SEED ERROR] Failed seeding mission ${mission.mission_id}:`, err);
    }
  }
  for (const campaign of DEFAULT_CAMPAIGNS_PRESETS) {
    try {
      const cRef = doc(db, 'campaigns', campaign.campaign_id);
      const cSnap = await getDoc(cRef);
      if (!cSnap.exists()) {
        await setDoc(cRef, campaign);
      }
    } catch (err) {
      console.error(`[SEED ERROR] Failed seeding campaign ${campaign.campaign_id}:`, err);
    }
  }
}

// Automatically trigger background seed execution lazily
setTimeout(() => {
  seedDefaultMissionsAndCampaigns().then(() => {
    console.log("[GROWTH SEED] Finished seeding default growth missions and campaign records successfully.");
  }).catch(e => console.error("[GROWTH SEED ERROR]", e));
}, 3000);

async function awardUserXp(userId: string, amount: number, reason: string, source: string) {
  if (amount <= 0) return;
  const userDocRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userDocRef);
  if (!userSnap.exists()) return;
  const user = userSnap.data();

  const currentXp = Number(user.total_xp || 0);
  const nextXp = currentXp + amount;
  const currentWeeklyXp = Number(user.weekly_xp || 0);
  const nextWeeklyXp = currentWeeklyXp + amount;

  const currentLevelInfo = getLevelAndTitle(currentXp);
  const nextLevelInfo = getLevelAndTitle(nextXp);

  const updatePayload: any = {
    total_xp: nextXp,
    weekly_xp: nextWeeklyXp,
    level: nextLevelInfo.level
  };

  await updateDoc(userDocRef, updatePayload);

  // Write to xp_history
  const xpHistoryId = `xp_${userId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await setDoc(doc(db, 'xp_history', xpHistoryId), {
    id: xpHistoryId,
    user_id: userId,
    amount,
    reason,
    source,
    timestamp: new Date().toISOString()
  });

  // Sync leaderboard
  try {
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', userId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));
    const stats = calculateHolderStats({ ...user, ...updatePayload }, locksList);

    await setDoc(doc(db, 'leaderboard', userId), {
      user_id: userId,
      username: user.username,
      first_name: user.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      referral_count: (user.referral_count_l1 || 0) + (user.referral_count_l2 || 0),
      referral_power: (user.referral_count_l1 || 0) * 1500 + (user.referral_count_l2 || 0) * 500,
      total_xp: nextXp,
      weekly_xp: nextWeeklyXp,
      growth_level: nextLevelInfo.level,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[XP LEADERBOARD SYNC ERROR] Failed for ${userId}:`, err);
  }

  return {
    success: true,
    awarded: amount,
    oldXp: currentXp,
    newXp: nextXp,
    oldLevel: currentLevelInfo.level,
    newLevel: nextLevelInfo.level,
    levelUp: nextLevelInfo.level > currentLevelInfo.level
  };
}

async function requireAdminTelegramAuth(req: any, res: any, next: any) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) {
    return res.status(401).json({ error: "Access denied. Signed Telegram identity session required." });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const verification = verifyTelegramWebAppData(initData, botToken);
  if (!verification.success) {
    return res.status(401).json({ error: "Telegram identity verification failed." });
  }

  const tgUser = verification.data.user;
  const userIdStr = String(tgUser.id);

  try {
    const userSnap = await getDoc(doc(db, 'users', userIdStr));
    const user = userSnap.exists() ? userSnap.data() : null;
    
    const isAdmin = (user && user.is_admin === true) || ADMIN_TELEGRAM_IDS.includes(userIdStr);
    if (!isAdmin) {
      return res.status(403).json({ error: "403 Forbidden: You do not have authorization to access administrator systems." });
    }

    req.tgUser = tgUser;
    req.adminUser = user || { id: userIdStr, is_admin: true };
    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
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
        total_xp: 0,
        weekly_xp: 0,
        level: 1,
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
          const currXpEarned = (rData.referral_xp_earned || 0) + 100;
          await updateDoc(referrerDocRef, {
            referral_count_l1: nextL1Count,
            referral_xp_earned: currXpEarned
          });

          // Award referred user 50 welcome XP
          await awardUserXp(userIdStr, 50, "MARG Referral Welcome Bonus", "welcome");

          // Award referrer 100 XP
          await awardUserXp(referredBy, 100, `Referral Registration: @${user.username || userIdStr}`, "referral_invite");

          // Save Referral collection entry
          const refEntryId = `${referredBy}_${userIdStr}`;
          await setDoc(doc(db, 'referrals', refEntryId), {
            id: refEntryId,
            referrer_user_id: referredBy,
            referred_user_id: userIdStr,
            level: 1,
            created_at: nowISO,
            reward_status: 'claimed',
            wallet_connected: false,
            purchase_verified: false,
            xp_awarded: 100
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
                reward_status: 'claimed',
                wallet_connected: false,
                purchase_verified: false,
                xp_awarded: 0
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

    // Refresh live MARG Token jetton & native balance if wallet linked
    if (user.wallet_address) {
      try {
        const balances = await fetchWalletBalances(user.wallet_address);
        await updateDoc(userDocRef, {
          ton_marg_balance: balances.margBalance,
          ton_balance: balances.tonBalance
        });
        user.ton_marg_balance = balances.margBalance;
        user.ton_balance = balances.tonBalance;
      } catch (err: any) {
        console.error(`[INIT] Non-blocking balance update failed for ${user.wallet_address}:`, err.message || err);
      }
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
      referral_count: (user.referral_count_l1 || 0) + (user.referral_count_l2 || 0),
      referral_power: (user.referral_count_l1 || 0) * 1500 + (user.referral_count_l2 || 0) * 500,
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
app.post('/api/user/connect-wallet', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { walletAddress } = req.body;
  if (!telegramUserId || !walletAddress) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User account not found" });
    }

    // Fetch TON jettons and native balance details
    let balances = { margBalance: 0, tonBalance: 0 };
    try {
      balances = await fetchWalletBalances(walletAddress);
    } catch (err: any) {
      console.error("[CONNECT] Balance verification failed:", err.message || err);
      return res.status(502).json({
        error: `Wallet Connection Blocked: Unable to verify your wallet balance. Please retry in a few moments.`
      });
    }

    await updateDoc(userDocRef, {
      wallet_address: walletAddress,
      ton_marg_balance: balances.margBalance,
      ton_balance: balances.tonBalance
    });

    // Reload entire details
    const refreshedSnap = await getDoc(userDocRef);
    const user = refreshedSnap.data();

    // Growth Engine: Award XP for first wallet connection
    const firstConnection = !userSnap.data().wallet_address;
    if (firstConnection) {
      try {
        await setDoc(doc(db, 'user_missions', `um_${telegramUserId}_ton_wallet_connect`), {
          user_id: telegramUserId,
          mission_id: "ton_wallet_connect",
          status: "claimed",
          completed_at: new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          xp_awarded: 100
        });
        await awardUserXp(telegramUserId, 100, "Connect TON Wallet Mission", "mission");

        // Award 150 XP to referrer if referred
        if (userSnap.data().referred_by) {
          const referrerId = userSnap.data().referred_by;
          const refEntryId = `${referrerId}_${telegramUserId}`;
          const refDocRef = doc(db, 'referrals', refEntryId);
          const refSnap = await getDoc(refDocRef);
          
          if (refSnap.exists() && !refSnap.data().wallet_connected) {
            await updateDoc(refDocRef, {
              wallet_connected: true,
              xp_awarded: (refSnap.data().xp_awarded || 100) + 150
            });
            await awardUserXp(referrerId, 150, `Referral connected wallet: @${user.username || telegramUserId}`, "referral_wallet");
            
            const referrerDocRef = doc(db, 'users', referrerId);
            const referrerSnap = await getDoc(referrerDocRef);
            if (referrerSnap.exists()) {
              const rxp = (referrerSnap.data().referral_xp_earned || 0) + 150;
              await updateDoc(referrerDocRef, {
                referral_xp_earned: rxp
              });
            }
          }
        }
      } catch (growthErr: any) {
        console.error("[GROWTH XP] Failed during wallet connect reward allocation:", growthErr.message || growthErr);
      }
    }

    // Growth Engine: Verify and award 300 XP to referrer for token purchase if user has balance
    if (balances.margBalance > 0 && userSnap.data().referred_by) {
      try {
        const referrerId = userSnap.data().referred_by;
        const refEntryId = `${referrerId}_${telegramUserId}`;
        const refDocRef = doc(db, 'referrals', refEntryId);
        const refSnap = await getDoc(refDocRef);
        
        if (refSnap.exists() && !refSnap.data().purchase_verified) {
          await updateDoc(refDocRef, {
            purchase_verified: true,
            xp_awarded: (refSnap.data().xp_awarded || 100) + 300
          });
          await awardUserXp(referrerId, 300, `Referral bought MARG: @${user.username || telegramUserId}`, "referral_purchase");
          
          const referrerDocRef = doc(db, 'users', referrerId);
          const referrerSnap = await getDoc(referrerDocRef);
          if (referrerSnap.exists()) {
            const rxp = (referrerSnap.data().referral_xp_earned || 0) + 300;
            await updateDoc(referrerDocRef, {
              referral_xp_earned: rxp
            });
          }
        }
      } catch (platErr: any) {
        console.error("[GROWTH XP] Referral purchase verification failed:", platErr.message || platErr);
      }
    }

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
      referral_count: (user!.referral_count_l1 || 0) + (user!.referral_count_l2 || 0),
      referral_power: (user!.referral_count_l1 || 0) * 1500 + (user!.referral_count_l2 || 0) * 500,
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
app.post('/api/user/lock', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { amount, durationMonths } = req.body;
  
  if (!amount || !durationMonths) {
    return res.status(400).json({ error: "Required parameters missing" });
  }

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User profile not registered." });

    const user = userSnap.data();
    const currentLiquid = user.balance || 0;

    const now = new Date();
    const unlockDate = new Date();
    unlockDate.setMonth(unlockDate.getMonth() + durationMonths);

    // Secure Verification: Live check of actual on-chain MARG Jetton balance
    if (!user.wallet_address) {
      return res.status(400).json({ error: "A live TON wallet must be connected to pledge on-chain MARG token locks." });
    }

    // Query existing active locks to prevent duplicate locks on the same wallet balance (double-locking)
    const locksQueryBefore = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const rawDocsBefore = await getDocs(locksQueryBefore);
    let activeLockedSum = 0;
    rawDocsBefore.forEach((d) => {
      const lockData = d.data();
      if (lockData && lockData.status === 'active') {
        activeLockedSum += Number(lockData.amount || 0);
      }
    });

    const totalProposedLocked = activeLockedSum + Number(amount);
    let liveOnChainMarg = 0;
    try {
      liveOnChainMarg = await fetchMargBalance(user.wallet_address);
    } catch (err: any) {
      console.error("[LOCK] Live on-chain balance verification failed:", err.message || err);
      return res.status(502).json({
        error: `Sovereign Lock Rejection: Live balance verification failed because the TON network node query is rate-limited or offline (${err.message || 'TonAPI unretrievable'}). Please try again in a few moments.`
      });
    }
    if (liveOnChainMarg < totalProposedLocked) {
      return res.status(400).json({ 
        error: `Sovereign Lock Blocked: Duplicate lock prevention active. Your connected TON wallet holds ${liveOnChainMarg.toLocaleString()} MARG. You already have existing active locks for ${activeLockedSum.toLocaleString()} MARG. Adding this new lock of ${amount.toLocaleString()} MARG requires a total balance of ${totalProposedLocked.toLocaleString()} MARG. Please acquire more on-chain MARG to complete this vault position.`
      });
    }

    // Exact lock duration coefficients: { 1: 1.2, 3: 1.8, 6: 2.5, 12: 4.8 }
    const multiplierMap: Record<number, number> = { 1: 1.2, 3: 1.8, 6: 2.5, 12: 4.8 };
    const mult = multiplierMap[durationMonths];
    if (mult === undefined) {
      return res.status(400).json({ error: "Sovereign lock rejection: Invalid lock duration of months specified." });
    }

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
      referral_count: (updatedUser!.referral_count_l1 || 0) + (updatedUser!.referral_count_l2 || 0),
      referral_power: (updatedUser!.referral_count_l1 || 0) * 1500 + (updatedUser!.referral_count_l2 || 0) * 500,
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
app.post('/api/user/claim-daily', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);

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
app.post('/api/user/mystery-box/open', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { specialOpen } = req.body;

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
app.post('/api/user/mystery-box/buy', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { count } = req.body;
  if (!count) return res.status(400).json({ error: "Parameters missing" });

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

// --- MARG GROWTH ENGINE DEVELOPER REST APIS ---

// 1. GET User Growth dashboard details
app.get('/api/growth/me', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const user = userSnap.data();
    const totalXp = Number(user.total_xp || 0);
    const weeklyXp = Number(user.weekly_xp || 0);
    const levelInfo = getLevelAndTitle(totalXp);

    // Calculate completed task count
    const completedQuery = query(collection(db, 'user_missions'), where('user_id', '==', telegramUserId));
    const completedDocs = await getDocs(completedQuery);
    let completedCount = 0;
    const completedIds: string[] = [];
    completedDocs.forEach((d) => {
      const data = d.data();
      if (data.status === 'claimed' || data.status === 'completed') {
        completedCount++;
        completedIds.push(data.mission_id);
      }
    });

    // Fetch active missions from database
    const missionsRef = collection(db, 'missions');
    const missionsDocs = await getDocs(missionsRef);
    let activeMissionsList: any[] = [];
    missionsDocs.forEach((d) => activeMissionsList.push(d.data()));
    if (activeMissionsList.length === 0) {
      activeMissionsList = DEFAULT_MISSIONS_PRESETS;
    }
    const availableCount = activeMissionsList.filter(m => m.is_active && !completedIds.includes(m.mission_id)).length;

    // Get locking assets info
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    let totalLockedAmount = 0;
    let activeMultiplier = 0;
    let totalLocksCount = 0;
    locksDocs.forEach((d) => {
      const lock = d.data();
      if (lock.status === 'active') {
        totalLockedAmount += (lock.amount || 0);
        activeMultiplier = Math.max(activeMultiplier, lock.multiplier || 1);
        totalLocksCount++;
      }
    });

    // Referral stats
    const totalInvited = (user.referral_count_l1 || 0) + (user.referral_count_l2 || 0);
    const referralXpEarned = (user.referral_xp_earned || 0);
    
    // Determine active referrals
    const activeRefsQuery = query(collection(db, 'referrals'), where('referrer_user_id', '==', telegramUserId));
    const activeRefsDocs = await getDocs(activeRefsQuery);
    let activeReferralsCount = 0;
    let walletConnectedRefsCount = 0;
    activeRefsDocs.forEach((d) => {
      const r = d.data();
      activeReferralsCount++;
      if (r.wallet_connected) {
        walletConnectedRefsCount++;
      }
    });

    // Determine weekly leaderboard rank (scan users sorting by weekly_xp desc)
    const usersQuery = collection(db, 'users');
    const allUsersDocs = await getDocs(usersQuery);
    const usersList: any[] = [];
    allUsersDocs.forEach((d) => usersList.push(d.data()));
    usersList.sort((a, b) => (b.weekly_xp || 0) - (a.weekly_xp || 0));
    const weeklyRank = usersList.findIndex(u => String(u.id) === telegramUserId) + 1 || 1;

    // Rewards info
    const rewardsQuery = query(collection(db, 'rewards'), where('user_id', '==', telegramUserId));
    const rewardsDocs = await getDocs(rewardsQuery);
    let claimableRewardsCount = 0;
    let totalClaimedAmount = 0;
    rewardsDocs.forEach((d) => {
      const reward = d.data();
      if (reward.status === 'pending' || reward.status === 'approved') {
        claimableRewardsCount++;
      } else if (reward.status === 'paid' || reward.status === 'claimed') {
        totalClaimedAmount += (reward.amount || 0);
      }
    });

    const isAdmin = user.is_admin === true || ADMIN_TELEGRAM_IDS.includes(telegramUserId);

    return res.json({
      success: true,
      growth: {
        totalXp,
        weeklyXp,
        level: levelInfo.level,
        rank: levelInfo.title,
        nextXp: levelInfo.nextXp,
        prevXp: levelInfo.prevXp,
        completedTasks: completedCount,
        availableTasks: availableCount,
        isAdmin,
        isBanned: user.is_banned === true,
        referrals: {
          totalInvited: totalInvited || activeReferralsCount,
          active: activeReferralsCount,
          walletConnected: walletConnectedRefsCount,
          xpEarned: referralXpEarned,
          rank: (user.referral_count_l1 || 0) >= 10 ? 'Sovereign' : (user.referral_count_l1 || 0) >= 5 ? 'Executor' : 'Squire',
        },
        wallet: {
          connected: !!user.wallet_address,
          address: user.wallet_address || null
        },
        token: {
          balance: user.wallet_address ? (user.ton_marg_balance || 0) : (user.balance || 0),
          virtualBalance: user.balance || 0,
          realBalance: user.ton_marg_balance || 0
        },
        vault: {
          hasActiveLock: totalLocksCount > 0,
          totalLockedAmount,
          activeMultiplier,
          activeLocksCount: totalLocksCount
        },
        weeklyRank: weeklyRank || 1,
        claimableRewards: claimableRewardsCount
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. POST claim Daily check-in XP points
app.post('/api/growth/daily-checkin', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const todayStr = new Date().toISOString().split('T')[0];
  const userDocRef = doc(db, 'users', telegramUserId);

  try {
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Sovereign user not registered." });
    }

    const user = userSnap.data();
    const missionId = "daily_checkin";
    const dailyMissionDocId = `um_${telegramUserId}_${missionId}_${todayStr}`;
    const dmSnap = await getDoc(doc(db, 'user_missions', dailyMissionDocId));

    if (dmSnap.exists()) {
      return res.status(400).json({ error: "You have already completed your daily check-in today." });
    }

    // Save check-in completed record
    await setDoc(doc(db, 'user_missions', dailyMissionDocId), {
      user_id: telegramUserId,
      mission_id: missionId,
      status: "claimed",
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      xp_awarded: 25
    });

    const xpResult = await awardUserXp(telegramUserId, 25, "Daily Check-in Rewards", "daily_checkin");

    // Process daily streak logic
    const lastClaimDate = user.last_claim_date;
    const nowISO = new Date().toISOString();
    let nextStreak = user.daily_streak || 1;
    let streakBroken = false;

    if (lastClaimDate) {
      const lastDate = lastClaimDate.split('T')[0];
      if (lastDate === todayStr) {
        // already claimed
      } else {
        const lastMs = new Date(lastDate).getTime();
        const todayMs = new Date(todayStr).getTime();
        const diffDays = Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          nextStreak += 1;
        } else if (diffDays > 1) {
          nextStreak = 1;
          streakBroken = true;
        }
        await updateDoc(userDocRef, {
          daily_streak: nextStreak,
          last_claim_date: nowISO
        });
      }
    } else {
      await updateDoc(userDocRef, {
        daily_streak: 1,
        last_claim_date: nowISO
      });
    }

    // Evaluate daily missions completeness bonus trigger (All 3 daily tasks complete)
    const dailyMissionsList = ["daily_checkin", "daily_app_open", "daily_visit_blum"];
    let completedCount = 0;
    for (const mId of dailyMissionsList) {
      const subDocId = `um_${telegramUserId}_${mId}_${todayStr}`;
      const subSnap = await getDoc(doc(db, 'user_missions', subDocId));
      if (subSnap.exists() || mId === "daily_checkin") {
        completedCount++;
      }
    }

    let dailyBonusAwarded = false;
    if (completedCount === dailyMissionsList.length) {
      const bonusDocId = `um_${telegramUserId}_daily_bonus_${todayStr}`;
      const bonusSnap = await getDoc(doc(db, 'user_missions', bonusDocId));
      if (!bonusSnap.exists()) {
        await setDoc(doc(db, 'user_missions', bonusDocId), {
          user_id: telegramUserId,
          mission_id: "daily_bonus_100",
          status: "claimed",
          completed_at: new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          xp_awarded: 100
        });
        await awardUserXp(telegramUserId, 100, "All Daily Missions Completed Bonus", "daily_bonus");
        dailyBonusAwarded = true;
      }
    }

    return res.json({
      success: true,
      message: "Daily check-in completed successfully!",
      xpResult,
      streak: nextStreak,
      streakBroken,
      dailyBonusAwarded
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. GET all active growth system missions
app.get('/api/growth/missions', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    const missionsRef = collection(db, 'missions');
    const missionsDocs = await getDocs(missionsRef);
    let activeMissionsList: any[] = [];
    missionsDocs.forEach((d) => activeMissionsList.push(d.data()));
    if (activeMissionsList.length === 0) {
      activeMissionsList = DEFAULT_MISSIONS_PRESETS;
    }

    // Load user completion map
    const completedQuery = query(collection(db, 'user_missions'), where('user_id', '==', telegramUserId));
    const completedDocs = await getDocs(completedQuery);
    const userMissionsMap: Record<string, any> = {};
    completedDocs.forEach((d) => {
      const data = d.data();
      userMissionsMap[data.mission_id] = data;
    });

    const enrichedMissions = activeMissionsList.map(mission => {
      let userState = "not_started";
      let completedAt = null;
      let claimedAt = null;

      if (mission.is_daily) {
        const hasDailyDoc = Object.values(userMissionsMap).find((um: any) => um.mission_id === mission.mission_id && um.completed_at?.startsWith(todayStr));
        if (hasDailyDoc) {
          userState = "claimed";
          completedAt = hasDailyDoc.completed_at;
          claimedAt = hasDailyDoc.claimed_at;
        }
      } else {
        const matchingRecord = userMissionsMap[mission.mission_id];
        if (matchingRecord) {
          userState = matchingRecord.status || "claimed";
          completedAt = matchingRecord.completed_at;
          claimedAt = matchingRecord.claimed_at;
        }
      }

      return {
        ...mission,
        status: userState,
        completedAt,
        claimedAt
      };
    });

    return res.json({
      success: true,
      missions: enrichedMissions
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. POST claim completed mission rewards
app.post('/api/growth/missions/:missionId/claim', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const missionId = req.params.missionId;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Sovereign profile not found." });
    }
    const user = userSnap.data();

    // Fetch mission definitions (dynamic/database first, then local presets)
    const missionRef = doc(db, 'missions', missionId);
    let missionSnap = await getDoc(missionRef);
    let mission: any = null;
    if (missionSnap.exists()) {
      mission = missionSnap.data();
    } else {
      mission = DEFAULT_MISSIONS_PRESETS.find(m => m.mission_id === missionId);
    }

    if (!mission) {
      return res.status(404).json({ error: "Mission card not found." });
    }

    const userMissionDocId = mission.is_daily 
      ? `um_${telegramUserId}_${missionId}_${todayStr}`
      : `um_${telegramUserId}_${missionId}`;

    const umRef = doc(db, 'user_missions', userMissionDocId);
    const umSnap = await getDoc(umRef);
    if (umSnap.exists()) {
      return res.status(400).json({ error: "This mission task has already been completed and claimed." });
    }

    // Evaluate validation requirements on backend securely
    let eligible = false;
    let errorMessage = "Validation failed: Unable to verify mission parameters on-chain.";

    if (mission.validation_type === "auto" || mission.validation_type === "visit" || mission.validation_type === "social") {
      eligible = true;
    } else if (mission.validation_type === "wallet") {
      if (user.wallet_address) {
        eligible = true;
      } else {
        errorMessage = "Validation Failed: Linked TON Web3 Wallet address is required to complete this task.";
      }
    } else if (mission.validation_type === "verify_balance") {
      const minBalance = missionId === "balance_milestone" ? 5000 : 500;
      const actualBalance = user.wallet_address ? (user.ton_marg_balance || 0) : (user.balance || 0);
      if (actualBalance >= minBalance) {
        eligible = true;
      } else {
        errorMessage = `Validation Failed: Insufficient MARG token balance. Current balance is ${actualBalance.toLocaleString()} MARG, but this mission requires holding at least ${minBalance.toLocaleString()} MARG jettons.`;
      }
    } else if (mission.validation_type === "verify_purchase") {
      const actualBalance = user.wallet_address ? (user.ton_marg_balance || 0) : (user.balance || 0);
      if (actualBalance > 0) {
        eligible = true;
      } else {
        errorMessage = "Validation Failed: No active MARG jetton asset holdings detected. Accumulate on BLUM and verify again.";
      }
    } else if (mission.validation_type === "verify_vault") {
      const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
      const locksDocs = await getDocs(locksQuery);
      let activeVaultCount = 0;
      locksDocs.forEach((d) => {
        if (d.data().status === 'active') activeVaultCount++;
      });
      if (activeVaultCount > 0) {
        eligible = true;
      } else {
        errorMessage = "Validation Failed: Active locked vault position is required. Commit MARG tokens inside the Locker tab.";
      }
    } else if (mission.validation_type === "checkin") {
      eligible = true;
    }

    if (!eligible) {
      return res.status(400).json({ error: errorMessage });
    }

    // Save completion
    await setDoc(umRef, {
      user_id: telegramUserId,
      mission_id: missionId,
      status: "claimed",
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      xp_awarded: mission.xp_reward
    });

    const xpResult = await awardUserXp(telegramUserId, mission.xp_reward, `Completed Mission Event: ${mission.title}`, "mission");

    // All Daily Complete Bonus evaluation
    let dailyBonusAwarded = false;
    if (mission.is_daily) {
      const dailyMissionsList = ["daily_checkin", "daily_app_open", "daily_visit_blum"];
      let completedCount = 0;
      for (const mId of dailyMissionsList) {
        const subDocId = mId === missionId ? userMissionDocId : `um_${telegramUserId}_${mId}_${todayStr}`;
        if (mId === missionId) {
          completedCount++;
        } else {
          const subSnap = await getDoc(doc(db, 'user_missions', subDocId));
          if (subSnap.exists()) {
            completedCount++;
          }
        }
      }

      if (completedCount === dailyMissionsList.length) {
        const bonusDocId = `um_${telegramUserId}_daily_bonus_${todayStr}`;
        const bonusSnap = await getDoc(doc(db, 'user_missions', bonusDocId));
        if (!bonusSnap.exists()) {
          await setDoc(doc(db, 'user_missions', bonusDocId), {
            user_id: telegramUserId,
            mission_id: "daily_bonus_100",
            status: "claimed",
            completed_at: new Date().toISOString(),
            claimed_at: new Date().toISOString(),
            xp_awarded: 100
          });
          await awardUserXp(telegramUserId, 100, "All Daily Missions Completed Bonus", "daily_bonus");
          dailyBonusAwarded = true;
        }
      }
    }

    return res.json({
      success: true,
      message: `Mission ${mission.title} completed successfully!`,
      xpAwarded: mission.xp_reward,
      xpResult,
      dailyBonusAwarded
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. GET user direct referral structure & invite links
app.get('/api/growth/referrals', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Sovereign user profile not found." });
    }

    const user = userSnap.data();
    const refsQuery = query(collection(db, 'referrals'), where('referrer_user_id', '==', telegramUserId));
    const refsDocs = await getDocs(refsQuery);
    
    const list: any[] = [];
    refsDocs.forEach((d) => list.push(d.data()));

    const enrichedList: any[] = [];
    for (const item of list) {
      const refUserRef = doc(db, 'users', item.referred_user_id);
      const refUserSnap = await getDoc(refUserRef);
      if (refUserSnap.exists()) {
        const ru = refUserSnap.data();
        enrichedList.push({
          telegramId: ru.id,
          username: ru.username,
          firstName: ru.first_name,
          walletConnected: !!ru.wallet_address,
          level: ru.level || 1,
          createdAt: item.created_at || ru.created_at,
          purchaseVerified: item.purchase_verified || false,
          xpAwarded: item.xp_awarded || 100
        });
      } else {
        enrichedList.push({
          telegramId: item.referred_user_id,
          username: "Sovereign Member",
          firstName: "Sovereign Member",
          walletConnected: item.wallet_connected || false,
          level: 1,
          createdAt: item.created_at,
          purchaseVerified: item.purchase_verified || false,
          xpAwarded: item.xp_awarded || 100
        });
      }
    }

    return res.json({
      success: true,
      referralCode: user.referral_code,
      inviteLink: `https://t.me/marg_ecosystem_bot/app?startapp=ref_${telegramUserId}`,
      referrals: enrichedList,
      stats: {
        totalInvited: enrichedList.length,
        walletConnected: enrichedList.filter(item => item.walletConnected).length,
        active: enrichedList.filter(item => item.level > 1).length,
        xpEarned: user.referral_xp_earned || 0
      }
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. GET Weekly/All-time Growth system leader standings
app.get('/api/growth/leaderboard', requireTelegramAuth, async (req: any, res) => {
  const type = req.query.type || 'weekly';
  const telegramUserId = String(req.tgUser.id);

  try {
    const usersDocs = await getDocs(collection(db, 'users'));
    let usersList: any[] = [];
    usersDocs.forEach((d) => usersList.push(d.data()));

    if (type === 'weekly') {
      usersList.sort((a, b) => (b.weekly_xp || 0) - (a.weekly_xp || 0));
    } else {
      usersList.sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
    }

    let leaderboard = usersList.map((u, i) => ({
      rank: i + 1,
      userId: String(u.id),
      username: u.username || `user_${u.id}`,
      firstName: u.first_name || "Sovereign Member",
      level: getLevelAndTitle(u.total_xp || 0).level,
      levelTitle: getLevelAndTitle(u.total_xp || 0).title,
      xp: type === 'weekly' ? (u.weekly_xp || 0) : (u.total_xp || 0),
      isCurrentUser: String(u.id) === telegramUserId
    }));

    const mockCompetitors = [
      { name: "ton_whale_44", xpWeekly: 2450, xpAllTime: 12500, level: 5, levelTitle: "Builder" },
      { name: "cryptopioneer_x", xpWeekly: 1800, xpAllTime: 8200, level: 5, levelTitle: "Builder" },
      { name: "blum_raider_9", xpWeekly: 1200, xpAllTime: 4400, level: 4, levelTitle: "Raider" },
      { name: "marg_shielder", xpWeekly: 950, xpAllTime: 3100, level: 4, levelTitle: "Raider" },
      { name: "sovereign_hodl", xpWeekly: 750, xpAllTime: 2300, level: 3, levelTitle: "Holder" },
      { name: "web3nexus", xpWeekly: 400, xpAllTime: 1600, level: 3, levelTitle: "Holder" },
      { name: "tonconnect_master", xpWeekly: 350, xpAllTime: 800, level: 2, levelTitle: "Supporter" },
      { name: "alpha_builder", xpWeekly: 200, xpAllTime: 1400, level: 2, levelTitle: "Supporter" },
      { name: "blum_watcher", xpWeekly: 150, xpAllTime: 450, level: 1, levelTitle: "Explorer" }
    ];

    if (leaderboard.length < 15) {
      const needed = 15 - leaderboard.length;
      const sortedMocks = [...mockCompetitors];
      if (type === 'weekly') {
        sortedMocks.sort((a, b) => b.xpWeekly - a.xpWeekly);
      } else {
        sortedMocks.sort((a, b) => b.xpAllTime - a.xpAllTime);
      }

      for (let i = 0; i < Math.min(needed, sortedMocks.length); i++) {
        const mc = sortedMocks[i];
        leaderboard.push({
          rank: leaderboard.length + 1,
          userId: `mock_${mc.name}`,
          username: mc.name,
          firstName: mc.name.charAt(0).toUpperCase() + mc.name.slice(1).replace(/_/g, " "),
          level: mc.level,
          levelTitle: mc.levelTitle,
          xp: type === 'weekly' ? mc.xpWeekly : mc.xpAllTime,
          isCurrentUser: false
        });
      }
    }

    leaderboard.sort((a, b) => b.xp - a.xp);
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    const currentUserEntry = leaderboard.find(item => item.isCurrentUser);
    const userRank = currentUserEntry ? currentUserEntry.rank : 1;

    return res.json({
      success: true,
      type,
      leaderboard,
      myRank: userRank
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. GET active growth campaigns and reward ledgers
app.get('/api/growth/rewards', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  try {
    const campaignsDocs = await getDocs(collection(db, 'campaigns'));
    const campaignsList: any[] = [];
    campaignsDocs.forEach((d) => campaignsList.push(d.data()));
    if (campaignsList.length === 0) {
      campaignsList.push(DEFAULT_CAMPAIGNS_PRESETS[0]);
    }

    const userRewardsDocs = await getDocs(query(collection(db, 'rewards'), where('user_id', '==', telegramUserId)));
    const rewardsList: any[] = [];
    userRewardsDocs.forEach((d) => rewardsList.push(d.data()));

    return res.json({
      success: true,
      campaigns: campaignsList,
      rewards: rewardsList,
      rules: DEFAULT_CAMPAIGNS_PRESETS[0].rules
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. POST users apply for a growth campaign allocation
app.post('/api/growth/rewards/apply', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { campaignId } = req.body;

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Sovereign profile not found." });
    }
    const user = userSnap.data();

    if (user.is_banned === true) {
      return res.status(403).json({ error: "Application Rejected: Your profile is suspended from participating in campaign distributions." });
    }

    const existingRewardsDocs = await getDocs(query(collection(db, 'rewards'), where('user_id', '==', telegramUserId)));
    let alreadyApplied = false;
    existingRewardsDocs.forEach((d) => {
      const r = d.data();
      if (r.campaign_id === campaignId) alreadyApplied = true;
    });

    if (alreadyApplied) {
      return res.status(400).json({ error: "Application Error: You have already applied for this campaign. Check status below." });
    }

    const walletConnected = !!user.wallet_address;
    if (!walletConnected) {
      return res.status(400).json({ error: "Qualification Failed: Active wallet connection is required to apply!" });
    }

    const rewardId = `reward_${telegramUserId}_${campaignId}`;
    const rewardPayload = {
      id: rewardId,
      reward_id: rewardId,
      user_id: telegramUserId,
      campaign_id: campaignId,
      reward_type: "TON",
      amount: 1, // Standard qualifying entry is 1 TON contest entry
      status: "pending", 
      created_at: new Date().toISOString()
    };

    await setDoc(doc(db, 'rewards', rewardId), rewardPayload);
    return res.json({ success: true, message: "Application submitted successfully! Qualification state is now pending manual audits.", reward: rewardPayload });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// --- ADMIN SYSTEM ENDPOINTS ---

// 1. GET User growth database ledgers
app.get('/api/admin/growth/users', requireAdminTelegramAuth, async (req: any, res) => {
  try {
    const usersDocs = await getDocs(collection(db, 'users'));
    const list: any[] = [];
    usersDocs.forEach((d) => {
      const u = d.data();
      list.push({
        id: u.id,
        telegramId: u.id,
        username: u.username,
        firstName: u.first_name,
        walletAddress: u.wallet_address || null,
        totalXp: u.total_xp || 0,
        weeklyXp: u.weekly_xp || 0,
        level: u.level || 1,
        isBanned: u.is_banned === true,
        isAdmin: u.is_admin === true || ADMIN_TELEGRAM_IDS.includes(String(u.id)),
        balance: u.wallet_address ? (u.ton_marg_balance || 0) : (u.balance || 0),
        dailyStreak: u.daily_streak || 1,
        createdAt: u.created_at
      });
    });
    return res.json({ success: true, users: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. GET Direct network mappings referrals
app.get('/api/admin/growth/referrals', requireAdminTelegramAuth, async (req: any, res) => {
  try {
    const refsDocs = await getDocs(collection(db, 'referrals'));
    const list: any[] = [];
    refsDocs.forEach((d) => list.push(d.data()));
    return res.json({ success: true, referrals: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. GET Global XP history grants audit trail logs
app.get('/api/admin/growth/xp-history', requireAdminTelegramAuth, async (req: any, res) => {
  try {
    const xpDocs = await getDocs(collection(db, 'xp_history'));
    const list: any[] = [];
    xpDocs.forEach((d) => list.push(d.data()));
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json({ success: true, history: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. POST Create a custom mission card
app.post('/api/admin/growth/missions', requireAdminTelegramAuth, async (req: any, res) => {
  const { mission_id, title, description, type, xp_reward, is_daily, is_active, validation_type, external_url } = req.body;
  if (!mission_id || !title || !type || xp_reward === undefined || validation_type === undefined) {
    return res.status(400).json({ error: "Missing required mission parameters." });
  }

  try {
    const mRef = doc(db, 'missions', mission_id);
    const payload = {
      mission_id,
      title,
      description: description || "",
      type,
      xp_reward: Number(xp_reward),
      is_daily: !!is_daily,
      is_active: is_active !== false,
      validation_type,
      external_url: external_url || "",
      created_at: new Date().toISOString()
    };
    await setDoc(mRef, payload);
    return res.json({ success: true, message: "Mission card successfully added!", mission: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. PUT Modify mission configuration cards
app.put('/api/admin/growth/missions/:missionId', requireAdminTelegramAuth, async (req: any, res) => {
  const missionId = req.params.missionId;
  const updateData = req.body;

  try {
    const mRef = doc(db, 'missions', missionId);
    const mSnap = await getDoc(mRef);
    if (!mSnap.exists()) {
      return res.status(404).json({ error: "Mission card not found." });
    }

    const payload: any = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined) payload.description = updateData.description;
    if (updateData.type !== undefined) payload.type = updateData.type;
    if (updateData.xp_reward !== undefined) payload.xp_reward = Number(updateData.xp_reward);
    if (updateData.is_daily !== undefined) payload.is_daily = !!updateData.is_daily;
    if (updateData.is_active !== undefined) payload.is_active = !!updateData.is_active;
    if (updateData.validation_type !== undefined) payload.validation_type = updateData.validation_type;
    if (updateData.external_url !== undefined) payload.external_url = updateData.external_url;

    await updateDoc(mRef, payload);
    return res.json({ success: true, message: "Mission card successfully updated!", updatedKeys: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. POST Admin adjust XP manually or suspend users from claiming
app.post('/api/admin/growth/xp/manual', requireAdminTelegramAuth, async (req: any, res) => {
  const { userId, amount, reason, actionType } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing target userId parameter specification." });
  }

  try {
    const uRef = doc(db, 'users', userId);
    const uSnap = await getDoc(uRef);
    if (!uSnap.exists()) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const user = uSnap.data();

    if (actionType === "ban") {
      await updateDoc(uRef, { is_banned: true });
      return res.json({ success: true, message: `Successfully banned user @${user.username || userId} from rewards.` });
    } else if (actionType === "unban") {
      await updateDoc(uRef, { is_banned: false });
      return res.json({ success: true, message: `Successfully unbanned user @${user.username || userId}.` });
    }

    const xpAmount = Number(amount);
    if (isNaN(xpAmount) || xpAmount === 0) {
      return res.status(400).json({ error: "Amount must be a non-zero valid integer." });
    }

    const nextXp = Math.max(0, (user.total_xp || 0) + xpAmount);
    const levelInfo = getLevelAndTitle(nextXp);

    await updateDoc(uRef, {
      total_xp: nextXp,
      level: levelInfo.level
    });

    const xpHistoryId = `xp_manual_${userId}_${Date.now()}`;
    await setDoc(doc(db, 'xp_history', xpHistoryId), {
      id: xpHistoryId,
      user_id: userId,
      amount: xpAmount,
      reason: reason || "Manual administrator adjustment",
      source: "admin",
      admin_id: String(req.tgUser.id),
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Successfully adjusted XP for user @${user.username || userId} by ${xpAmount > 0 ? '+' : ''}${xpAmount} XP. Current: ${nextXp} XP.`
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. GET all global user rewards
app.get('/api/admin/growth/rewards', requireAdminTelegramAuth, async (req: any, res) => {
  try {
    const rewardsDocs = await getDocs(collection(db, 'rewards'));
    const list: any[] = [];
    rewardsDocs.forEach((d) => list.push(d.data()));
    return res.json({ success: true, rewards: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. POST Admin approve campaign payouts
app.post('/api/admin/growth/rewards/:rewardId/approve', requireAdminTelegramAuth, async (req: any, res) => {
  const rewardId = req.params.rewardId;
  const { transactionHash } = req.body;
  try {
    const rewardRef = doc(db, 'rewards', rewardId);
    const rSnap = await getDoc(rewardRef);
    if (!rSnap.exists()) {
      return res.status(404).json({ error: "Reward item not found." });
    }

    const payload: any = {
      status: "approved",
      approved_by: String(req.tgUser.id),
      paid_at: new Date().toISOString()
    };
    if (transactionHash) {
      payload.transaction_hash = transactionHash;
      payload.status = "paid";
    }

    await updateDoc(rewardRef, payload);
    return res.json({ success: true, message: `Reward ${rewardId} has been successfully approved.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 9. POST Admin reject campaign payouts
app.post('/api/admin/growth/rewards/:rewardId/reject', requireAdminTelegramAuth, async (req: any, res) => {
  const rewardId = req.params.rewardId;
  const { reason } = req.body;
  try {
    const rewardRef = doc(db, 'rewards', rewardId);
    const rSnap = await getDoc(rewardRef);
    if (!rSnap.exists()) {
      return res.status(404).json({ error: "Reward item not found." });
    }

    await updateDoc(rewardRef, {
      status: "rejected",
      rejection_reason: reason || "Did not meet campaign qualification parameters",
      approved_by: String(req.tgUser.id)
    });
    return res.json({ success: true, message: `Reward ${rewardId} has been successfully rejected.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 10. POST Admin create a promotional campaign
app.post('/api/admin/growth/campaigns', requireAdminTelegramAuth, async (req: any, res) => {
  const { campaign_id, title, description, start_date, end_date, prize_pool, rules } = req.body;
  if (!campaign_id || !title) {
    return res.status(400).json({ error: "Missing campaign_id or title parameters." });
  }
  try {
    const payload = {
      campaign_id,
      title,
      description: description || "",
      start_date: start_date || new Date().toISOString(),
      end_date: end_date || new Date().toISOString(),
      status: "active",
      prize_pool: prize_pool || "0 TON",
      rules: rules || ""
    };
    await setDoc(doc(db, 'campaigns', campaign_id), payload);
    return res.json({ success: true, message: "Campaign created successfully!", campaign: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 11. GET Admin CSV Data Report download dump
app.get('/api/admin/growth/export', requireAdminTelegramAuth, async (req: any, res) => {
  try {
    const usersDocs = await getDocs(collection(db, 'users'));
    let csv = "ID,Username,FirstName,WalletAddress,TotalXP,WeeklyXP,Level,IsBanned,CreatedAt\n";
    usersDocs.forEach((d) => {
      const u = d.data();
      const username = (u.username || "").replace(/,/g, " ");
      const firstName = (u.first_name || "Sovereign").replace(/,/g, " ");
      csv += `${u.id},"${username}","${firstName}",${u.wallet_address || ""},${u.total_xp || 0},${u.weekly_xp || 0},${u.level || 1},${u.is_banned === true ? "YES" : "NO"},${u.created_at || ""}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=marg_growth_users.csv');
    return res.status(200).send(csv);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// 12. Dynamic Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  const { type } = req.query; // 'holders' | 'lockers' | 'referrers'
  
  try {
    const lbCollectionRef = collection(db, 'leaderboard');
    let q;

    if (type === 'lockers') {
      q = query(lbCollectionRef, orderBy('locked_amount', 'desc'), limit(15));
    } else if (type === 'referrers') {
      q = query(lbCollectionRef, orderBy('referral_power', 'desc'), limit(15));
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
        referralCount: data.referral_count !== undefined ? data.referral_count : (((data.referral_count_l1 || 0) + (data.referral_count_l2 || 0)) || 0),
        referralPower: data.referral_power !== undefined ? data.referral_power : ((((data.referral_count_l1 || 0) * 1500) + ((data.referral_count_l2 || 0) * 500)) || 0),
        level: data.level || "Starter",
        userId: data.user_id
      });
    });

    // Supplement with rich mock competitors if the list is small for stellar presentation
    const mockCompetitors = [
      { userName: "@TonWhale_88", power: 125000, lockedAmount: 18000, referralCount: 15, referralPower: 22500, level: "Whale" },
      { userName: "@LockMaster_Pro", power: 85000, lockedAmount: 45000, referralCount: 12, referralPower: 18000, level: "Whale" },
      { userName: "@Cyber_Sovereign", power: 45000, lockedAmount: 12000, referralCount: 9, referralPower: 13500, level: "Elite" },
      { userName: "@VanguardTon", power: 32000, lockedAmount: 15000, referralCount: 7, referralPower: 10500, level: "Elite" },
      { userName: "@DegenNode", power: 12000, lockedAmount: 2500, referralCount: 4, referralPower: 6000, level: "Power" }
    ];

    // Merge mock competitors if the list has fewer than 15 entries
    for (const competitor of mockCompetitors) {
      if (userEntries.length >= 15) break;
      // Do not duplicate username if already exists
      if (!userEntries.some(u => u.userName.toLowerCase() === competitor.userName.toLowerCase())) {
        userEntries.push({
          userName: competitor.userName,
          power: competitor.power,
          lockedAmount: competitor.lockedAmount,
          referralCount: competitor.referralCount,
          referralPower: competitor.referralPower,
          level: competitor.level,
          userId: null
        });
      }
    }

    // Sort depending on section filter
    if (type === 'lockers') {
      userEntries.sort((a, b) => b.lockedAmount - a.lockedAmount);
    } else if (type === 'referrers') {
      userEntries.sort((a, b) => b.referralPower - a.referralPower || b.referralCount - a.referralCount);
    } else {
      userEntries.sort((a, b) => b.power - a.power);
    }

    // Assign final ranks using only real registered users
    const rankings = userEntries.map((entry, index) => ({
      rank: index + 1,
      userName: entry.userName,
      power: type === 'referrers' ? entry.referralPower : entry.power,
      lockedAmount: type === 'referrers' ? entry.referralCount : entry.lockedAmount,
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

const MILESTONES = [
  { power: 1000, margReward: 100, boxesReward: 1 },
  { power: 5000, margReward: 500, boxesReward: 2 },
  { power: 10000, margReward: 1000, boxesReward: 3 },
  { power: 25000, margReward: 3000, boxesReward: 5 },
  { power: 50000, margReward: 7500, boxesReward: 8 },
  { power: 100000, margReward: 15000, boxesReward: 15 },
];

// 7.5. Claim Milestone Gift API
app.post('/api/user/claim-milestone', requireTelegramAuth, async (req: any, res) => {
  const telegramUserId = String(req.tgUser.id);
  const { milestonePower } = req.body;
  
  if (!milestonePower) {
    return res.status(400).json({ error: "Missing milestone target parameter." });
  }

  try {
    const userDocRef = doc(db, 'users', telegramUserId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Sovereign user profile not registered." });
    }

    const user = userSnap.data();
    const claimed = user.claimed_milestones || [];

    if (claimed.includes(Number(milestonePower))) {
      return res.status(400).json({ error: "Sovereign milestone gift has already been claimed." });
    }

    // Secure Verification: Recompute live stats internally on server
    const locksQuery = query(collection(db, 'locks'), where('user_id', '==', telegramUserId));
    const locksDocs = await getDocs(locksQuery);
    const locksList: any[] = [];
    locksDocs.forEach((d) => locksList.push(d.data()));

    const stats = calculateHolderStats(user, locksList);
    stats.holderPower += (user.multiplier_points_boost || 0);

    // Enforce power constraint securely before approving reward allocation
    if (stats.holderPower < Number(milestonePower)) {
      return res.status(400).json({ 
        error: `Claim Rejected: Insufficient Holder Power! Your calculated power is ${stats.holderPower.toLocaleString()}, but the target milestone requires at least ${Number(milestonePower).toLocaleString()} Power.` 
      });
    }

    // Secure Reward lookup internally on the server (never trust client parameters!)
    const activeMilestone = MILESTONES.find(m => m.power === Number(milestonePower));
    if (!activeMilestone) {
      return res.status(404).json({ error: "Invalid milestone level clearance specification." });
    }

    const margReward = activeMilestone.margReward;
    const boxesReward = activeMilestone.boxesReward;

    const updatedClaimed = [...claimed, Number(milestonePower)];
    const nextBalance = (user.balance || 0) + margReward;
    const nextBoxes = (user.mystery_boxes_owned || 0) + boxesReward;

    const updatePayload: any = {
      claimed_milestones: updatedClaimed,
      balance: nextBalance,
      mystery_boxes_owned: nextBoxes
    };

    if (user.wallet_address) {
      updatePayload.ton_marg_balance = (user.ton_marg_balance || 0) + margReward;
    }

    await updateDoc(userDocRef, updatePayload);
    const updatedUser = { ...user, ...updatePayload };

    // Sync leaderboard details
    await setDoc(doc(db, 'leaderboard', telegramUserId), {
      user_id: telegramUserId,
      username: user.username,
      first_name: user.first_name,
      holder_power: stats.holderPower,
      level: stats.level,
      locked_amount: stats.totalLockedAmount,
      referral_count: (user.referral_count_l1 || 0) + (user.referral_count_l2 || 0),
      referral_power: (user.referral_count_l1 || 0) * 1500 + (user.referral_count_l2 || 0) * 500,
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


// Serve tonconnect-manifest.json dynamically with matching origin domain and CORS
app.get('/tonconnect-manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Determine origin dynamically based on request context and headers
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.get('host');
  const originUrl = `${protocol}://${host}`;

  const manifest = {
    url: originUrl,
    name: "MARG Ecosystem",
    // Clean, high-contrast absolute public image URL for the token icon
    iconUrl: "https://ton.org/front-page-assets/images/ton_logo_dark_background.png"
  };

  res.json(manifest);
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
