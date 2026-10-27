import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  configureCloudQueue,
  enqueueCloudWrite,
  cancelCloudWrites,
  resetCloudQueueBatchSupport,
  type CloudQueueResponse,
} from './cloudQueue';
import {
  getCachedParty,
  getPartyCacheKey,
  invalidatePartyCacheForParty,
  putCachedParty,
  FRESH_TTL_MS,
  STALE_TTL_MS,
} from './partyCache';
import { isNetworkOnline } from '../services/networkService';

export const GOOGLE_SCRIPT_STORAGE_KEY = '@partysplit:google_script_url';

/**
 * Production Google Apps Script Web App used by default.
 * Users can still override it in Profile → Google Sheets settings.
 */
export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw-yfuH_3q70ktGnDpDCkKvDSyY8z5nhd2JVz38qk3IQ2LkevRAF9vBiFY9csbSIFaI/exec';

// Previous bundled deployment. If a user still has it saved as a custom URL,
// transparently move them to the current default instead of hitting the stale
// backend forever.
const LEGACY_DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxCAYhIXqNw_2-Nd_TRt749LvoKYPM3CPNSaRDsMT_dBK5Y0Qg17Zdq6SNjvlLXa8VP/exec';

export interface CloudUser {
  id: string;
  name: string;
  phone: string;
  bank: string;
  avatarUrl?: string;
}

export interface CloudParty {
  id: string;
  code: string;
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface CloudParticipant extends CloudUser {
  avatarColor?: string;
  joinedAt?: string;
}

export interface CloudExpense {
  id: string;
  partyId: string;
  title: string;
  amount: number;
  paidById: string;
  sharedUserIds: string[];
  createdAt: string;
  category?: string;
}

export interface CloudTransferStatus {
  transferId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  isPaid: boolean;
  updatedAt?: string;
}

export interface CloudShoppingItem {
  id: string;
  partyId: string;
  title: string;
  estimatedAmount?: number;
  assignedUserId?: string;
  isBought: boolean;
  boughtById?: string;
  actualAmount?: number;
  convertedExpenseId?: string;
  category?: string;
  createdAt?: string;
}

export interface PartyApiResponse {
  success: boolean;
  error?: string;
  party?: CloudParty;
  participants?: CloudParticipant[];
  expenses?: CloudExpense[];
  shoppingList?: CloudShoppingItem[];
  paymentStatuses?: CloudTransferStatus[];
  user?: CloudUser;
  token?: string;
  message?: string;
  apiVersion?: number;
  /** HTTP status, used by the retry queue to distinguish 429/5xx failures. */
  status?: number;
  retryAfterMs?: number;
  /** Set for a `batch` response; one entry per submitted operation. */
  results?: PartyApiResponse[];
  /** Read came from the local snapshot instead of the network. */
  fromCache?: boolean;
  /** Snapshot is older than the fresh TTL (offline fallback). */
  stale?: boolean;
}

export interface AuthCredentials {
  userId: string;
  token: string;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function asNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = asString(value).toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'да';
}

/**
 * Sheets often returns numbers as localized strings ("1 200,50"). Parse those
 * defensively while keeping "field is absent" distinct from a real zero.
 */
function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized =
    typeof value === 'string'
      ? value.replace(/\s+/g, '').replace(',', '.')
      : value;
  const numeric = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(asString).filter(Boolean);
      }
    } catch {
      // Not JSON — fall back to a comma-separated list.
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeUser(raw: unknown): CloudUser | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id);
  if (!id) return undefined;
  return {
    id,
    name: asString(item.name) || 'Участник',
    phone: asString(item.phone),
    bank: asString(item.bank) || asString(item.bankName) || 'Сбербанк',
    avatarUrl: asString(item.avatarUrl) || undefined,
  };
}

function normalizeParticipant(raw: unknown): CloudParticipant | null {
  const user = normalizeUser(raw);
  if (!user) return null;
  const item = raw as Record<string, unknown>;
  return {
    ...user,
    avatarUrl: user.avatarUrl || asString(item.avatarUrl) || undefined,
    avatarColor: asString(item.avatarColor) || undefined,
    joinedAt: asString(item.joinedAt) || undefined,
  };
}

function normalizeExpense(raw: unknown): CloudExpense | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id);
  const partyId = asString(item.partyId);
  if (!id) return null;

  return {
    id,
    partyId,
    title: asString(item.title) || 'Расход',
    amount: asNumber(item.amount),
    paidById: asString(item.paidById),
    sharedUserIds: asStringArray(item.sharedUserIds),
    createdAt: asString(item.createdAt),
    category: asString(item.category) || undefined,
  };
}

function normalizeTransferStatus(raw: unknown): CloudTransferStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const transferId = asString(item.transferId);
  if (!transferId) return null;
  return {
    transferId,
    fromUserId: asString(item.fromUserId),
    toUserId: asString(item.toUserId),
    amount: asNumber(item.amount),
    isPaid: asBoolean(item.isPaid),
    updatedAt: asString(item.updatedAt) || undefined,
  };
}

function normalizeShoppingItem(raw: unknown): CloudShoppingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id);
  if (!id) return null;

  const estimatedAmount = asOptionalNumber(item.estimatedAmount);
  const actualAmount = asOptionalNumber(item.actualAmount);

  return {
    id,
    partyId: asString(item.partyId),
    title: asString(item.title) || 'Покупка',
    estimatedAmount:
      estimatedAmount !== undefined && estimatedAmount > 0 ? estimatedAmount : undefined,
    assignedUserId: asString(item.assignedUserId) || undefined,
    isBought: asBoolean(item.isBought),
    boughtById: asString(item.boughtById) || undefined,
    actualAmount:
      actualAmount !== undefined && actualAmount > 0 ? actualAmount : undefined,
    convertedExpenseId: asString(item.convertedExpenseId) || undefined,
    category: asString(item.category) || undefined,
    createdAt: asString(item.createdAt) || undefined,
  };
}

function normalizeParty(raw: unknown): CloudParty | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id);
  if (!id) return undefined;

  return {
    id,
    code: asString(item.code).toUpperCase(),
    title: asString(item.title) || 'Тусовка',
    createdBy: asString(item.createdBy),
    createdAt: asString(item.createdAt),
  };
}

/**
 * Makes the Apps Script response safe for the app. Google Sheets returns
 * numeric cells for phone numbers, and older backend versions could return
 * missing arrays — both used to crash the app after joining a room.
 */
function normalizeApiResponse(json: unknown): PartyApiResponse {
  if (!json || typeof json !== 'object') {
    return {
      success: false,
      error: 'Сервер вернул некорректный ответ. Проверьте URL и доступ «Все» у веб-приложения.',
    };
  }

  const raw = json as Record<string, unknown>;
  const participants = Array.isArray(raw.participants)
    ? (raw.participants.map(normalizeParticipant).filter(Boolean) as CloudParticipant[])
    : undefined;
  const expenses = Array.isArray(raw.expenses)
    ? (raw.expenses.map(normalizeExpense).filter(Boolean) as CloudExpense[])
    : undefined;
  const paymentStatuses = Array.isArray(raw.paymentStatuses)
    ? (raw.paymentStatuses
        .map(normalizeTransferStatus)
        .filter(Boolean) as CloudTransferStatus[])
    : undefined;
  // This is the shared shopping list shown in the room. It used to be dropped
  // here, so cloud reads always looked like an empty list on every device.
  const shoppingList = Array.isArray(raw.shoppingList)
    ? (raw.shoppingList
        .map(normalizeShoppingItem)
        .filter(Boolean) as CloudShoppingItem[])
    : undefined;
  const results = Array.isArray(raw.results)
    ? raw.results.map((entry) => normalizeApiResponse(entry))
    : undefined;

  return {
    success: Boolean(raw.success),
    error: asString(raw.error) || undefined,
    party: normalizeParty(raw.party),
    participants,
    expenses,
    shoppingList,
    paymentStatuses,
    user: normalizeUser(raw.user),
    token: asString(raw.token) || undefined,
    message: asString(raw.message) || undefined,
    apiVersion: raw.apiVersion === undefined ? undefined : asNumber(raw.apiVersion),
    results,
    fromCache: raw.fromCache === true || undefined,
    stale: raw.stale === true || undefined,
  };
}

// Resolving the URL hits AsyncStorage. Keep it in memory so the polling and
// write queues do not perform an extra storage read for every request.
let resolvedScriptUrl: string | null = null;

/**
 * Gets the configured Google Apps Script Web App URL from AsyncStorage.
 * Falls back to the bundled production URL when the user has not overridden it.
 */
export async function getGoogleScriptUrl(): Promise<string> {
  if (resolvedScriptUrl) return resolvedScriptUrl;

  try {
    const url = await AsyncStorage.getItem(GOOGLE_SCRIPT_STORAGE_KEY);
    const trimmed = (url || '').trim();
    if (!trimmed) {
      resolvedScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
      return resolvedScriptUrl;
    }

    if (trimmed === LEGACY_DEFAULT_GOOGLE_SCRIPT_URL) {
      await AsyncStorage.removeItem(GOOGLE_SCRIPT_STORAGE_KEY);
      resolvedScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
      return resolvedScriptUrl;
    }

    resolvedScriptUrl = trimmed;
    return resolvedScriptUrl;
  } catch {
    resolvedScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
    return resolvedScriptUrl;
  }
}

/**
 * Saves a new Google Apps Script Web App URL to AsyncStorage.
 * An empty value restores the bundled default URL.
 */
export async function setGoogleScriptUrl(url: string): Promise<void> {
  try {
    const trimmed = url.trim();
    if (!trimmed) {
      await AsyncStorage.removeItem(GOOGLE_SCRIPT_STORAGE_KEY);
      resolvedScriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;
      resetCloudQueueBatchSupport();
      return;
    }
    await AsyncStorage.setItem(GOOGLE_SCRIPT_STORAGE_KEY, trimmed);
    resolvedScriptUrl = trimmed;
    resetCloudQueueBatchSupport();
  } catch (err) {
    console.warn('[GoogleSheetsApi] Failed to save URL:', err);
  }
}

const STALE_BACKEND_MESSAGE =
  'Сервер Google Sheets старой версии: в нём нет части функций синхронизации (авторизация, статусы оплат или пакетная запись). Скопируйте актуальный backend/Code.gs в Apps Script и сделайте новое развёртывание (Deploy → Manage deployments → Edit → New version).';

/**
 * Makes server errors actionable: an outdated Apps Script deployment responds
 * with "Неизвестное действие" for all new sync actions.
 */
function humanizeServerError(message: string): string {
  if (/неизвестное действие/i.test(message)) {
    return STALE_BACKEND_MESSAGE;
  }
  if (/сессия|токен|авторизац/i.test(message)) {
    return `${message} Войдите в аккаунт заново.`;
  }
  return message;
}

/**
 * Generic request helper with timeout and Google Apps Script redirect handling.
 * It never throws for expected HTTP/network failures: the queue and screens
 * receive a normalized `{ success: false }` result instead.
 */
async function callAppsScriptApi(
  action: string,
  data: Record<string, any> = {}
): Promise<PartyApiResponse> {
  const scriptUrl = await getGoogleScriptUrl();

  if (!scriptUrl) {
    return {
      success: false,
      error: 'URL Google Apps Script не настроен. Настройте его на вкладке «Профиль и Настройки».',
    };
  }

  const payload = {
    action,
    ...data,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Google Apps Script handles text/plain with JSON body seamlessly without CORS preflight blocks
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 0;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : undefined;

    const text = await response.text();
    try {
      const normalized = normalizeApiResponse(JSON.parse(text));
      normalized.status = response.status;
      if (retryAfterMs) normalized.retryAfterMs = retryAfterMs;
      if (!normalized.success && normalized.error) {
        normalized.error = humanizeServerError(normalized.error);
      }
      return normalized;
    } catch {
      return {
        success: false,
        status: response.status,
        retryAfterMs,
        error: response.ok
          ? 'Сервер вернул некорректный ответ. Проверьте, что веб-приложение развёрнуто с доступом «Все» (Anyone).'
          : `Сервер вернул ошибку ${response.status}. Проверьте доступ «Все» (Anyone) у веб-приложения.`,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        status: 0,
        error: 'Превышено время ожидания ответа от Google Sheets (15s)',
      };
    }
    return {
      success: false,
      status: 0,
      error: `Ошибка сети: ${err.message || 'Не удалось связаться с сервером'}`,
    };
  }
}

/**
 * Tests connection to Google Apps Script and the new API version.
 */
export async function testGoogleScriptConnection(customUrl?: string): Promise<{
  success: boolean;
  message: string;
}> {
  const urlToTest = customUrl ? customUrl.trim() : await getGoogleScriptUrl();

  if (!urlToTest) {
    return { success: false, message: 'URL не указан' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const testUrl = urlToTest.includes('?') ? `${urlToTest}&action=ping` : `${urlToTest}?action=ping`;
    const res = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        message: 'Веб-приложение вернуло не JSON. Проверьте доступ «Все» (Anyone) при развёртывании.',
      };
    }

    if (json.status === 'online' || json.success) {
      // Probe the deployment version. The probe is read-only and does not
      // require a session, so it is safe to run before login.
      try {
        const probeController = new AbortController();
        const probeTimeoutId = setTimeout(() => probeController.abort(), 12000);
        const probe = await fetch(urlToTest, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'version' }),
          signal: probeController.signal,
          redirect: 'follow',
        });
        clearTimeout(probeTimeoutId);
        const probeJson = JSON.parse(await probe.text());
        const capabilities = Array.isArray(probeJson.capabilities)
          ? probeJson.capabilities.map((item: unknown) => String(item))
          : [];
        if (
          !probeJson.success ||
          Number(probeJson.apiVersion) < 2 ||
          !capabilities.includes('batch')
        ) {
          return {
            success: false,
            message: STALE_BACKEND_MESSAGE,
          };
        }
      } catch {
        return {
          success: false,
          message: STALE_BACKEND_MESSAGE,
        };
      }
      resetCloudQueueBatchSupport();
      return { success: true, message: 'Подключение успешно! Авторизация и синхронизация оплат доступны.' };
    }
    return { success: false, message: json.error || json.message || 'Связь не установлена' };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      message: `Не удалось подключиться: ${err.message || 'Проверьте права доступа "Anyone" при развёртывании Web App'}`,
    };
  }
}

export async function registerUserInCloud(data: {
  name: string;
  phone: string;
  bank: string;
  password: string;
}): Promise<PartyApiResponse> {
  return callAppsScriptApi('registerUser', data);
}

export async function loginUserInCloud(data: {
  phone: string;
  password: string;
}): Promise<PartyApiResponse> {
  return callAppsScriptApi('loginUser', data);
}

export async function updateUserProfileInCloud(
  auth: AuthCredentials,
  data: {
    name: string;
    phone: string;
    bank: string;
    avatarUrl?: string;
    newPassword?: string;
    partyId?: string;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('updateUserProfile', {
    userId: auth.userId,
    token: auth.token,
    ...data,
  });
}

export async function createPartyInCloud(
  title: string,
  auth: AuthCredentials,
  bank: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('createParty', {
    title,
    userId: auth.userId,
    token: auth.token,
    bank,
  });
}

export async function joinPartyInCloud(
  code: string,
  auth: AuthCredentials,
  bank: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('joinParty', {
    code,
    userId: auth.userId,
    token: auth.token,
    bank,
  });
}

const inflightPartyReads = new Map<string, Promise<PartyApiResponse>>();

export interface PartyReadOptions {
  /** Manual refresh should bypass the fresh snapshot. */
  forceRefresh?: boolean;
  /** Background polling may fall back to the last known-good snapshot. */
  allowStale?: boolean;
}

export async function getPartyDetailsFromCloud(
  partyId: string,
  code: string,
  auth: AuthCredentials,
  options: PartyReadOptions = {}
): Promise<PartyApiResponse> {
  const scriptUrl = await getGoogleScriptUrl();
  const cacheKey = getPartyCacheKey(scriptUrl, partyId, code);

  if (!isNetworkOnline()) {
    const cached = await getCachedParty(cacheKey);
    if (cached) return { ...cached, fromCache: true, stale: true };
    return {
      success: false,
      status: 0,
      error: 'Отсутствует подключение к интернету (оффлайн-режим)',
    };
  }

  if (!options.forceRefresh) {
    const fresh = await getCachedParty(cacheKey, FRESH_TTL_MS);
    if (fresh) return { ...fresh, fromCache: true };
  }

  // Coalesce simultaneous reads with the same cache policy. A manual refresh
  // must not share a background request that is allowed to return stale data
  // (and vice versa), otherwise a forced refresh could silently show an old
  // snapshot.
  const inflightKey = `${cacheKey}|${options.forceRefresh ? 'force' : 'normal'}|${
    options.allowStale ? 'stale' : 'strict'
  }`;
  const existing = inflightPartyReads.get(inflightKey);
  if (existing) return existing;

  const request = (async (): Promise<PartyApiResponse> => {
    const response = await callAppsScriptApi('getPartyDetails', {
      partyId,
      code,
      userId: auth.userId,
      token: auth.token,
    });

    if (response.success) {
      void putCachedParty(cacheKey, response);
      return response;
    }

    if (options.allowStale || !isNetworkOnline() || response.status === 0) {
      const stale = await getCachedParty(cacheKey, STALE_TTL_MS);
      if (stale) {
        return {
          ...stale,
          fromCache: true,
          stale: true,
          status: response.status,
        };
      }
    }

    return response;
  })();

  inflightPartyReads.set(inflightKey, request);
  try {
    return await request;
  } finally {
    inflightPartyReads.delete(inflightKey);
  }
}

export async function addExpenseToCloud(
  partyId: string,
  auth: AuthCredentials,
  expense: {
    id?: string;
    title: string;
    amount: number;
    paidById: string;
    sharedUserIds: string[];
    category?: string;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('addExpense', {
    partyId,
    userId: auth.userId,
    token: auth.token,
    ...expense,
  });
}

export async function updateExpenseInCloud(
  partyId: string,
  auth: AuthCredentials,
  expense: {
    id: string;
    title: string;
    amount: number;
    paidById: string;
    sharedUserIds: string[];
    category?: string;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('updateExpense', {
    partyId,
    expenseId: expense.id,
    userId: auth.userId,
    token: auth.token,
    ...expense,
  });
}

export async function deleteExpenseFromCloud(
  expenseId: string,
  partyId: string,
  auth: AuthCredentials
): Promise<PartyApiResponse> {
  return callAppsScriptApi('deleteExpense', {
    expenseId,
    partyId,
    userId: auth.userId,
    token: auth.token,
  });
}

export async function updatePartyTitleInCloud(
  partyId: string,
  title: string,
  auth: AuthCredentials
): Promise<PartyApiResponse> {
  return callAppsScriptApi('updatePartyTitle', {
    partyId,
    title,
    userId: auth.userId,
    token: auth.token,
  });
}

export async function setTransferStatusInCloud(
  partyId: string,
  auth: AuthCredentials,
  status: {
    transferId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    isPaid: boolean;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('setTransferStatus', {
    partyId,
    roomId: partyId,
    // `userId` is the authenticated actor, not the debtor. The backend checks
    // that this user is either the debtor or the creditor before accepting the
    // status change.
    userId: auth.userId,
    token: auth.token,
    transferId: status.transferId,
    fromUserId: status.fromUserId,
    toUserId: status.toUserId,
    amount: status.amount,
    isPaid: status.isPaid,
  });
}

export async function leavePartyInCloud(
  partyId: string,
  auth: AuthCredentials
): Promise<PartyApiResponse> {
  return callAppsScriptApi('leaveParty', {
    partyId,
    userId: auth.userId,
    token: auth.token,
  });
}

export async function addShoppingItemToCloud(
  partyId: string,
  auth: AuthCredentials,
  item: {
    id?: string;
    title: string;
    estimatedAmount?: number;
    assignedUserId?: string;
    category?: string;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('addShoppingItem', {
    partyId,
    userId: auth.userId,
    token: auth.token,
    ...item,
  });
}

export async function updateShoppingItemInCloud(
  partyId: string,
  auth: AuthCredentials,
  item: {
    id: string;
    title?: string;
    estimatedAmount?: number;
    assignedUserId?: string;
    isBought?: boolean;
    boughtById?: string;
    actualAmount?: number;
    convertedExpenseId?: string;
    category?: string;
  }
): Promise<PartyApiResponse> {
  return callAppsScriptApi('updateShoppingItem', {
    partyId,
    itemId: item.id,
    userId: auth.userId,
    token: auth.token,
    ...item,
  });
}

export async function deleteShoppingItemFromCloud(
  itemId: string,
  partyId: string,
  auth: AuthCredentials
): Promise<PartyApiResponse> {
  return callAppsScriptApi('deleteShoppingItem', {
    itemId,
    partyId,
    userId: auth.userId,
    token: auth.token,
  });
}

// ---------------------------------------------------------------------------
// Queued optimistic mutations
//
// Screens update Zustand immediately and call these fire-and-forget helpers.
// The queue batches several actions into one Apps Script POST, coalesces
// repeated actions, retries transient failures, and only then invokes the
// caller's rollback/toast.
// ---------------------------------------------------------------------------

export interface CloudMutationOptions {
  coalesceKey?: string;
  debounceMs?: number;
  priority?: number;
  onSuccess?: (response: PartyApiResponse) => void;
  onFailure?: (response: PartyApiResponse) => void;
  silent?: boolean;
  failureMessage?: string;
}

function enqueueMutation(
  action: string,
  data: Record<string, unknown>,
  partyId: string,
  options: CloudMutationOptions
): void {
  // The optimistic state is newer than any cached room snapshot, so do not
  // let a background read resurrect the previous version.
  void invalidatePartyCacheForParty(partyId);

  enqueueCloudWrite({
    action,
    data,
    partyId,
    coalesceKey: options.coalesceKey,
    debounceMs: options.debounceMs,
    priority: options.priority,
    silent: options.silent,
    failureMessage: options.failureMessage,
    onSuccess: options.onSuccess
      ? (response) => options.onSuccess!(response as unknown as PartyApiResponse)
      : undefined,
    onFailure: options.onFailure
      ? (response) => options.onFailure!(response as unknown as PartyApiResponse)
      : undefined,
  });
}

export function queueAddExpenseToCloud(
  partyId: string,
  auth: AuthCredentials,
  expense: {
    id?: string;
    title: string;
    amount: number;
    paidById: string;
    sharedUserIds: string[];
    category?: string;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `expense:add:${partyId}:${expense.id || ''}`,
    debounceMs = 120,
    priority = 10,
    failureMessage = 'Не удалось отправить расход в Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'addExpense',
    {
      partyId,
      userId: auth.userId,
      token: auth.token,
      ...expense,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueUpdateExpenseToCloud(
  partyId: string,
  auth: AuthCredentials,
  expense: {
    id: string;
    title: string;
    amount: number;
    paidById: string;
    sharedUserIds: string[];
    category?: string;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `expense:update:${partyId}:${expense.id}`,
    debounceMs = 300,
    priority = 9,
    failureMessage = 'Не удалось обновить расход в Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'updateExpense',
    {
      partyId,
      expenseId: expense.id,
      userId: auth.userId,
      token: auth.token,
      ...expense,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueDeleteExpenseFromCloud(
  expenseId: string,
  partyId: string,
  auth: AuthCredentials,
  options: CloudMutationOptions = {}
): void {
  // A delete supersedes a not-yet-sent add/update for the same row.
  cancelCloudWrites(
    (operation) =>
      operation.partyId === partyId &&
      (operation.action === 'addExpense' || operation.action === 'updateExpense') &&
      (operation.data.id === expenseId || operation.data.expenseId === expenseId)
  );

  const {
    coalesceKey = `expense:delete:${partyId}:${expenseId}`,
    debounceMs = 0,
    priority = 20,
    failureMessage = 'Не удалось удалить расход из Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'deleteExpense',
    {
      expenseId,
      partyId,
      userId: auth.userId,
      token: auth.token,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueUpdatePartyTitleInCloud(
  partyId: string,
  title: string,
  auth: AuthCredentials,
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `party:title:${partyId}`,
    debounceMs = 500,
    priority = 5,
    failureMessage = 'Не удалось сохранить название комнаты',
    ...rest
  } = options;

  enqueueMutation(
    'updatePartyTitle',
    {
      partyId,
      title,
      userId: auth.userId,
      token: auth.token,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueSetTransferStatusInCloud(
  partyId: string,
  auth: AuthCredentials,
  status: {
    transferId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    isPaid: boolean;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `party:transfer:${partyId}:${status.transferId}`,
    debounceMs = 0,
    priority = 15,
    failureMessage = 'Не удалось сохранить статус оплаты',
    ...rest
  } = options;

  enqueueMutation(
    'setTransferStatus',
    {
      partyId,
      roomId: partyId,
      // The authenticated actor. Only the debtor or creditor may confirm a
      // payment, and the backend validates that from this field.
      userId: auth.userId,
      token: auth.token,
      transferId: status.transferId,
      fromUserId: status.fromUserId,
      toUserId: status.toUserId,
      amount: status.amount,
      isPaid: status.isPaid,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueLeavePartyInCloud(
  partyId: string,
  auth: AuthCredentials,
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `party:leave:${partyId}`,
    debounceMs = 0,
    priority = 100,
    failureMessage = 'Не удалось выйти из комнаты',
    ...rest
  } = options;

  enqueueMutation(
    'leaveParty',
    {
      partyId,
      userId: auth.userId,
      token: auth.token,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueAddShoppingItemToCloud(
  partyId: string,
  auth: AuthCredentials,
  item: {
    id: string;
    title: string;
    estimatedAmount?: number;
    assignedUserId?: string;
    category?: string;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `shopping:add:${partyId}:${item.id}`,
    debounceMs = 0,
    priority = 10,
    failureMessage = 'Не удалось сохранить покупку в Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'addShoppingItem',
    {
      partyId,
      roomId: partyId,
      userId: auth.userId,
      token: auth.token,
      ...item,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueUpdateShoppingItemToCloud(
  partyId: string,
  auth: AuthCredentials,
  item: {
    id: string;
    title?: string;
    // Cleared optional fields are sent as explicit null: JSON.stringify drops
    // undefined keys, and the backend keeps the sheet value for missing keys.
    estimatedAmount?: number | null;
    assignedUserId?: string | null;
    isBought?: boolean;
    boughtById?: string | null;
    actualAmount?: number | null;
    convertedExpenseId?: string | null;
    category?: string | null;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `shopping:update:${partyId}:${item.id}`,
    debounceMs = 250,
    priority = 9,
    failureMessage = 'Не удалось обновить покупку в Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'updateShoppingItem',
    {
      partyId,
      roomId: partyId,
      itemId: item.id,
      userId: auth.userId,
      token: auth.token,
      ...item,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueDeleteShoppingItemFromCloud(
  itemId: string,
  partyId: string,
  auth: AuthCredentials,
  options: CloudMutationOptions = {}
): void {
  cancelCloudWrites(
    (operation) =>
      operation.partyId === partyId &&
      (operation.action === 'addShoppingItem' || operation.action === 'updateShoppingItem') &&
      (operation.data.id === itemId || operation.data.itemId === itemId)
  );

  const {
    coalesceKey = `shopping:delete:${partyId}:${itemId}`,
    debounceMs = 0,
    priority = 12,
    failureMessage = 'Не удалось удалить покупку из Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'deleteShoppingItem',
    {
      partyId,
      roomId: partyId,
      itemId,
      id: itemId,
      userId: auth.userId,
      token: auth.token,
    },
    partyId,
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

export function queueUpdateUserProfileInCloud(
  auth: AuthCredentials,
  data: {
    name: string;
    phone: string;
    bank: string;
    avatarUrl?: string;
    partyId?: string;
  },
  options: CloudMutationOptions = {}
): void {
  const {
    coalesceKey = `user:profile:${auth.userId}`,
    debounceMs = 300,
    priority = 25,
    failureMessage = 'Не удалось обновить профиль в Google Sheets',
    ...rest
  } = options;

  enqueueMutation(
    'updateUserProfile',
    {
      userId: auth.userId,
      token: auth.token,
      ...data,
    },
    data.partyId || '',
    { ...rest, coalesceKey, debounceMs, priority, failureMessage }
  );
}

configureCloudQueue({
  executeBatch: async (operations) => {
    const response = await callAppsScriptApi('batch', { operations });
    return response as unknown as CloudQueueResponse;
  },
  executeSingle: async (operation) => {
    const response = await callAppsScriptApi(operation.action, operation.data);
    return response as unknown as CloudQueueResponse;
  },
  onCommitted: (operations) => {
    const partyIds = new Set(
      operations.map((operation) => operation.partyId).filter(Boolean)
    );
    partyIds.forEach((partyId) => {
      void invalidatePartyCacheForParty(String(partyId));
    });
  },
});
