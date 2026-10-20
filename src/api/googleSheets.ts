import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParticipantProfile } from '../types';

export const GOOGLE_SCRIPT_STORAGE_KEY = '@partysplit:google_script_url';

/**
 * Production Google Apps Script Web App used by default.
 * Users can still override it in Profile → Google Sheets settings.
 */
export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxCAYhIXqNw_2-Nd_TRt749LvoKYPM3CPNSaRDsMT_dBK5Y0Qg17Zdq6SNjvlLXa8VP/exec';

export interface CloudParty {
  id: string;
  code: string;
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface CloudParticipant {
  id: string;
  name: string;
  phone: string;
  paymentUrl?: string;
  avatarColor?: string;
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

export interface PartyApiResponse {
  success: boolean;
  error?: string;
  party?: CloudParty;
  participants?: CloudParticipant[];
  expenses?: CloudExpense[];
  user?: any;
  expense?: any;
  message?: string;
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

function normalizeParticipant(raw: unknown): CloudParticipant | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id);
  if (!id) return null;

  return {
    id,
    name: asString(item.name) || 'Участник',
    // Google Sheets often stores phone numbers as numeric cells.
    phone: asString(item.phone),
    paymentUrl: asString(item.paymentUrl) || undefined,
    avatarColor: asString(item.avatarColor) || undefined,
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

  return {
    success: Boolean(raw.success),
    error: asString(raw.error) || undefined,
    party: normalizeParty(raw.party),
    participants,
    expenses,
    user: raw.user,
    expense: raw.expense,
    message: asString(raw.message) || undefined,
  };
}

/**
 * Gets the configured Google Apps Script Web App URL from AsyncStorage.
 * Falls back to the bundled production URL when the user has not overridden it.
 */
export async function getGoogleScriptUrl(): Promise<string> {
  try {
    const url = await AsyncStorage.getItem(GOOGLE_SCRIPT_STORAGE_KEY);
    const trimmed = (url || '').trim();
    return trimmed || DEFAULT_GOOGLE_SCRIPT_URL;
  } catch {
    return DEFAULT_GOOGLE_SCRIPT_URL;
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
      return;
    }
    await AsyncStorage.setItem(GOOGLE_SCRIPT_STORAGE_KEY, trimmed);
  } catch (err) {
    console.warn('[GoogleSheetsApi] Failed to save URL:', err);
  }
}

/**
 * Makes server errors actionable: an outdated Apps Script deployment responds
 * with "Неизвестное действие" for all new sync actions.
 */
function humanizeServerError(message: string): string {
  if (/неизвестное действие/i.test(message)) {
    return 'Сервер Google Sheets старой версии: в нём нет новых действий синхронизации. Скопируйте актуальный backend/Code.gs в Apps Script и сделайте новое развёртывание (Deploy → Manage deployments → Edit → New version).';
  }
  return message;
}

/**
 * Generic request helper with timeout and Google Apps Script redirect handling.
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
  const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

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

    const text = await response.text();
    try {
      const normalized = normalizeApiResponse(JSON.parse(text));
      if (!normalized.success && normalized.error) {
        normalized.error = humanizeServerError(normalized.error);
      }
      return normalized;
    } catch {
      return {
        success: false,
        error: response.ok
          ? 'Сервер вернул некорректный ответ. Проверьте, что веб-приложение развёрнуто с доступом «Все» (Anyone).'
          : `Сервер вернул ошибку ${response.status}. Проверьте доступ «Все» (Anyone) у веб-приложения.`,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Превышено время ожидания ответа от Google Sheets (18s)' };
    }
    return {
      success: false,
      error: `Ошибка сети: ${err.message || 'Не удалось связаться с сервером'}`,
    };
  }
}

/**
 * Tests connection to Google Apps Script.
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
      // Probe the deployment version: participant/cheque synchronization
      // requires the new actions. The probe performs no writes.
      try {
        const probeController = new AbortController();
        const probeTimeoutId = setTimeout(() => probeController.abort(), 12000);
        const probe = await fetch(urlToTest, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'syncPartyMembers' }),
          signal: probeController.signal,
          redirect: 'follow',
        });
        clearTimeout(probeTimeoutId);
        const probeJson = JSON.parse(await probe.text());
        if (
          !probeJson.success &&
          /неизвестное действие/i.test(String(probeJson.error || ''))
        ) {
          return {
            success: false,
            message:
              'Скрипт отвечает, но он старой версии. Скопируйте актуальный backend/Code.gs в Apps Script и сделайте новое развёртывание (Deploy → Manage deployments → Edit → New version).',
          };
        }
      } catch {
        // Version probe is best-effort; a successful ping is enough to connect.
      }
      return { success: true, message: 'Подключение успешно! Таблицы готовы к работе.' };
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

/**
 * 1. Registers or updates user credentials in Google Sheets Users table.
 */
export async function registerOrUpdateUserInCloud(
  user: ParticipantProfile
): Promise<PartyApiResponse> {
  return callAppsScriptApi('registerOrUpdateUser', {
    id: user.id,
    name: user.name,
    phone: user.paymentInfo.phone,
    paymentUrl: user.paymentInfo.sbpQrOrUrl || '',
  });
}

/**
 * 2. Creates a party room in Google Sheets, generating a 6-character room code.
 */
export async function createPartyInCloud(
  title: string,
  user: ParticipantProfile
): Promise<PartyApiResponse> {
  return callAppsScriptApi('createParty', {
    title,
    createdBy: user.id,
    userId: user.id,
    name: user.name,
    phone: user.paymentInfo.phone,
    paymentUrl: user.paymentInfo.sbpQrOrUrl || '',
  });
}

/**
 * 3. Joins an existing party room by 6-character room code.
 */
export async function joinPartyInCloud(
  code: string,
  user: ParticipantProfile
): Promise<PartyApiResponse> {
  return callAppsScriptApi('joinParty', {
    code: code.trim().toUpperCase(),
    userId: user.id,
    name: user.name,
    phone: user.paymentInfo.phone,
    paymentUrl: user.paymentInfo.sbpQrOrUrl || '',
  });
}

/**
 * 4. Gets full party details (fresh members with payment credentials + all expenses).
 */
export async function getPartyDetailsFromCloud(
  partyId: string,
  code?: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('getPartyDetails', {
    partyId,
    code: code ? code.toUpperCase() : undefined,
  });
}

/**
 * 5. Adds a new expense to the party in Google Sheets. The client-generated
 * `id` is reused so that later edits/deletes on any device target the same row.
 */
export async function addExpenseToCloud(
  partyId: string,
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
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    paidById: expense.paidById,
    sharedUserIds: expense.sharedUserIds,
    category: expense.category,
  });
}

export interface CloudMemberPayload {
  id: string;
  name: string;
  phone?: string;
  paymentUrl?: string;
}

/**
 * 6. Pushes several participants into the room in one request: upserts their
 * profiles in Users and makes sure each of them is a PartyMembers row.
 * Returns the full fresh party (members + expenses) in the same response.
 */
export async function syncPartyMembersInCloud(
  partyId: string,
  members: CloudMemberPayload[]
): Promise<PartyApiResponse> {
  return callAppsScriptApi('syncPartyMembers', { partyId, members });
}

/**
 * 7. Removes a participant from the room and cleans their splits from expenses.
 */
export async function removePartyMemberFromCloud(
  partyId: string,
  userId: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('removePartyMember', { partyId, userId });
}

/**
 * 8. Updates an existing expense row (matched by its id on any device).
 */
export async function updateExpenseInCloud(expense: {
  id: string;
  title: string;
  amount: number;
  paidById: string;
  sharedUserIds: string[];
  category?: string;
}): Promise<PartyApiResponse> {
  return callAppsScriptApi('updateExpense', {
    expenseId: expense.id,
    title: expense.title,
    amount: expense.amount,
    paidById: expense.paidById,
    sharedUserIds: expense.sharedUserIds,
    category: expense.category,
  });
}

/**
 * 9. Deletes an expense row so every device stops showing it.
 */
export async function deleteExpenseFromCloud(
  expenseId: string,
  partyId?: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('deleteExpense', { expenseId, partyId });
}

/**
 * 10. Renames the party in Google Sheets.
 */
export async function updatePartyTitleInCloud(
  partyId: string,
  title: string
): Promise<PartyApiResponse> {
  return callAppsScriptApi('updatePartyTitle', { partyId, title });
}
