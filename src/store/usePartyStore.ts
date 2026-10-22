import { create } from 'zustand';
import {
  AuthSession,
  ExpenseItem,
  ItemCategory,
  PartyEvent,
  ShoppingItem,
  SimplifiedDebtTransfer,
  UserProfile,
} from '../types';
import { DEFAULT_BANK, normalizeBank } from '../constants/banks';
import { formatRubles, getAvatarColor } from '../utils/currency';
import { mergeCloudParty } from '../utils/cloudSync';
import {
  getPartyDetailsFromCloud,
  queueAddExpenseToCloud,
  queueAddShoppingItemToCloud,
  queueDeleteExpenseFromCloud,
  queueDeleteShoppingItemFromCloud,
  queueLeavePartyInCloud,
  queueSetTransferStatusInCloud,
  queueUpdateExpenseToCloud,
  queueUpdatePartyTitleInCloud,
  queueUpdateShoppingItemToCloud,
  queueUpdateUserProfileInCloud,
  updateUserProfileInCloud,
} from '../api/googleSheets';
import {
  cancelCloudWrites,
  flushOfflineQueue,
  getCloudWriteRevision,
  hasPendingCloudWrites,
  waitForCloudWrites,
} from '../api/cloudQueue';
import { loadItem, saveItem, STORAGE_KEYS } from './storage';
import { useNotificationStore } from './useNotificationStore';

const VALID_CATEGORIES: ItemCategory[] = ['food', 'drink', 'hookah', 'delivery', 'other'];

// Profiles and expenses shipped by older builds as a demo. They are removed
// on hydration so an app update starts with a genuinely empty room.
const DEMO_PROFILE_IDS = ['user_alex', 'user_maria', 'user_dmitry', 'user_elena'];
const DEMO_EXPENSE_IDS = ['exp_1', 'exp_2', 'exp_3'];

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
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(asString).filter(Boolean)));
}

function splitKey(expense: ExpenseItem): string {
  return (expense.splitBetween || [])
    .map((split) => split.userId)
    .slice()
    .sort()
    .join(',');
}

/**
 * Used to decide whether a failed optimistic edit is still the version the
 * user sees. If a newer edit has already replaced it, rollback must not
 * overwrite that newer state.
 */
function isSameExpenseSnapshot(a: ExpenseItem, b: ExpenseItem): boolean {
  return (
    a.title === b.title &&
    Math.abs(a.amount - b.amount) < 0.001 &&
    a.paidById === b.paidById &&
    (a.category || '') === (b.category || '') &&
    splitKey(a) === splitKey(b)
  );
}

interface ExpenseUpdateState {
  /** Last version known to be accepted by the server (starts as original). */
  lastPersisted: ExpenseItem;
  /** Latest optimistic edit, used to decide whether rollback is still safe. */
  latest: ExpenseItem;
  /** Number of update requests still in the queue for this expense. */
  pending: number;
}

// Keeps rollback correct when the user edits the same expense several times
// faster than the network can answer. Without this, a failure of the second
// request could restore the first (never persisted) optimistic version.
const expenseUpdateStates = new Map<string, ExpenseUpdateState>();

interface TitleUpdateState {
  lastPersisted: string;
  latest: string;
  pending: number;
}

const titleUpdateStates = new Map<string, TitleUpdateState>();

interface TransferUpdateState {
  /** Last isPaid value confirmed by the server. */
  lastPersisted: boolean;
  /** Latest value the user wants to see/send. */
  desired: boolean;
  pending: number;
}

const transferUpdateStates = new Map<string, TransferUpdateState>();

// Manual refresh and background polling can overlap. Track which read started
// last so an older response cannot overwrite a newer snapshot that already
// reached the store.
let syncReadSequence = 0;
let lastAppliedSyncRead = 0;

function clearPendingMutationState(partyId: string): void {
  Array.from(expenseUpdateStates.keys()).forEach((key) => {
    if (key.startsWith(`${partyId}:`)) expenseUpdateStates.delete(key);
  });
  Array.from(transferUpdateStates.keys()).forEach((key) => {
    if (key.startsWith(`${partyId}:`)) transferUpdateStates.delete(key);
  });
  titleUpdateStates.delete(partyId);
}

function expenseUpdateKey(partyId: string, expenseId: string): string {
  return `${partyId}:${expenseId}`;
}

function transferUpdateKey(partyId: string, transferId: string): string {
  return `${partyId}:${transferId}`;
}

function normalizeUser(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const id = asString(item.id);
  if (!id) return null;

  const name = asString(item.name) || 'Участник';
  // Compatibility with the previous SBP-profile shape while old local data
  // is migrated. The resulting model has no payment links.
  const legacyPayment =
    item.paymentInfo && typeof item.paymentInfo === 'object' ? item.paymentInfo : {};
  const phone = asString(item.phone) || asString(legacyPayment.phone);

  return {
    id,
    name,
    phone,
    bank: normalizeBank(asString(item.bank) || asString(item.bankName)),
    avatarColor: asString(item.avatarColor) || getAvatarColor(name),
    avatarUrl: asString(item.avatarUrl) || undefined,
  };
}

function normalizeLegacyProfiles(raw: unknown): Map<string, UserProfile> {
  const map = new Map<string, UserProfile>();
  if (!Array.isArray(raw)) return map;
  raw.forEach((entry) => {
    const user = normalizeUser(entry);
    if (user) map.set(user.id, user);
  });
  return map;
}

function normalizeExpense(raw: unknown): ExpenseItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const id = asString(item.id);
  if (!id) return null;

  const splitSource = Array.isArray(item.splitBetween)
    ? item.splitBetween
    : Array.isArray(item.sharedUserIds)
      ? item.sharedUserIds
      : [];
  const splitBetween = splitSource
    .map((entry: unknown) => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        return { userId: asString(entry) };
      }
      if (entry && typeof entry === 'object') {
        return { userId: asString((entry as Record<string, unknown>).userId) };
      }
      return { userId: '' };
    })
    .filter((entry: { userId: string }) => Boolean(entry.userId));

  const category = asString(item.category) as ItemCategory;

  return {
    id,
    title: asString(item.title) || 'Расход',
    amount: asNumber(item.amount),
    paidById: asString(item.paidById),
    splitBetween,
    category: VALID_CATEGORIES.includes(category) ? category : undefined,
    date: asString(item.date) || asString(item.createdAt) || undefined,
  };
}

function normalizeExpenses(raw: unknown): ExpenseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeExpense)
    .filter((expense): expense is ExpenseItem => Boolean(expense));
}

function normalizeShoppingItem(raw: unknown): ShoppingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const id = asString(item.id);
  const title = asString(item.title);
  if (!id || !title) return null;

  const category = asString(item.category) as ItemCategory;
  const estimatedAmount =
    item.estimatedAmount !== undefined && item.estimatedAmount !== null && item.estimatedAmount !== ''
      ? asNumber(item.estimatedAmount)
      : undefined;
  const actualAmount =
    item.actualAmount !== undefined && item.actualAmount !== null && item.actualAmount !== ''
      ? asNumber(item.actualAmount)
      : undefined;

  return {
    id,
    title,
    estimatedAmount: estimatedAmount && estimatedAmount > 0 ? estimatedAmount : undefined,
    assignedUserId: asString(item.assignedUserId || item.assignedToId) || undefined,
    isBought: Boolean(item.isBought),
    boughtById: asString(item.boughtById) || undefined,
    actualAmount: actualAmount && actualAmount > 0 ? actualAmount : undefined,
    convertedExpenseId: asString(item.convertedExpenseId) || undefined,
    category: VALID_CATEGORIES.includes(category) ? category : undefined,
    createdAt: asString(item.createdAt) || new Date().toISOString(),
  };
}

function normalizeShoppingList(raw: unknown): ShoppingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeShoppingItem)
    .filter((item): item is ShoppingItem => Boolean(item));
}

function normalizePartyEvent(
  raw: unknown,
  fallbackId?: string,
  legacyProfiles?: Map<string, UserProfile>
): PartyEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const participantsSource = Array.isArray(item.participants) ? item.participants : [];
  const seen = new Set<string>();
  const participants: UserProfile[] = [];

  participantsSource.forEach((entry: unknown) => {
    let user: UserProfile | null = null;
    if (entry && typeof entry === 'object') {
      user = normalizeUser(entry);
    } else {
      const id = asString(entry);
      if (id) {
        user =
          legacyProfiles?.get(id) ||
          ({
            id,
            name: 'Участник',
            phone: '',
            bank: DEFAULT_BANK,
            avatarColor: getAvatarColor(id),
          } as UserProfile);
      }
    }
    if (user && !seen.has(user.id)) {
      seen.add(user.id);
      participants.push(user);
    }
  });

  return {
    id: asString(item.id) || fallbackId || `party_${Date.now()}`,
    code: asString(item.code).toUpperCase() || undefined,
    title: asString(item.title) || 'Тусовка',
    date: asString(item.date) || new Date().toISOString(),
    createdBy: asString(item.createdBy) || undefined,
    participants,
    expenses: normalizeExpenses(item.expenses),
    shoppingList: normalizeShoppingList(item.shoppingList),
    settledTransferIds: asStringArray(item.settledTransferIds),
    deletedExpenseIds: asStringArray(item.deletedExpenseIds),
    pendingExpenseIds: asStringArray(item.pendingExpenseIds),
  };
}

function removeDemoData(party: PartyEvent): PartyEvent {
  const removedParticipantIds = new Set(
    (party.participants || [])
      .filter((participant) => DEMO_PROFILE_IDS.includes(participant.id))
      .map((participant) => participant.id)
  );
  const participants = (party.participants || []).filter(
    (participant) => !removedParticipantIds.has(participant.id)
  );
  const expenses = (party.expenses || []).filter((expense) => {
    if (DEMO_EXPENSE_IDS.includes(expense.id)) return false;
    // Also drop user-created cheques that reference a removed demo person,
    // otherwise balances would point at participants who no longer exist.
    if (removedParticipantIds.has(expense.paidById)) return false;
    return !(expense.splitBetween || []).some((split) =>
      removedParticipantIds.has(split.userId)
    );
  });

  const hadDemoData =
    participants.length !== (party.participants || []).length ||
    expenses.length !== (party.expenses || []).length;
  if (!hadDemoData) return party;

  // The untouched demo room should look like a brand-new empty room. A real
  // room (with a cloud code or its own title) only loses the demo entries.
  if (!party.code && participants.length === 0 && expenses.length === 0) {
    return createDefaultParty();
  }

  return {
    ...party,
    participants,
    expenses,
  };
}

function createDefaultParty(): PartyEvent {
  return {
    id: `party_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: 'Новая тусовка',
    date: new Date().toISOString(),
    participants: [],
    expenses: [],
    shoppingList: [],
    settledTransferIds: [],
    deletedExpenseIds: [],
    pendingExpenseIds: [],
  };
}

/**
 * Stable signature used to skip store writes/rerenders when an 8-second poll
 * returns exactly the same room. JSON key order is normalized explicitly.
 */
function partySignature(party: PartyEvent): string {
  return JSON.stringify({
    id: party.id,
    code: party.code || '',
    title: party.title,
    date: party.date,
    createdBy: party.createdBy || '',
    participants: (party.participants || []).map((participant) => [
      participant.id,
      participant.name,
      participant.phone,
      participant.bank,
      participant.avatarColor || '',
      participant.avatarUrl || '',
    ]),
    expenses: (party.expenses || []).map((expense) => [
      expense.id,
      expense.title,
      expense.amount,
      expense.paidById,
      (expense.splitBetween || []).map((split) => split.userId).slice().sort(),
      expense.category || '',
      expense.date || '',
    ]),
    shoppingList: (party.shoppingList || []).map((item) => [
      item.id,
      item.title,
      item.estimatedAmount || 0,
      item.assignedUserId || '',
      item.isBought ? 1 : 0,
      item.boughtById || '',
      item.actualAmount || 0,
      item.convertedExpenseId || '',
      item.category || '',
    ]),
    settledTransferIds: (party.settledTransferIds || []).slice().sort(),
    deletedExpenseIds: (party.deletedExpenseIds || []).slice().sort(),
    pendingExpenseIds: (party.pendingExpenseIds || []).slice().sort(),
  });
}

function normalizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const user = normalizeUser(item.user);
  const token = asString(item.token);
  if (!user || !token) return null;
  return { user, token };
}

function refreshSelfInParty(
  party: PartyEvent,
  user: UserProfile,
  addIfMissing: boolean
): PartyEvent {
  const exists = (party.participants || []).some((participant) => participant.id === user.id);
  if (exists) {
    return {
      ...party,
      participants: party.participants.map((participant) =>
        participant.id === user.id
          ? {
              ...participant,
              name: user.name,
              phone: user.phone,
              avatarColor: participant.avatarColor || user.avatarColor,
              avatarUrl: user.avatarUrl !== undefined ? user.avatarUrl : participant.avatarUrl,
              // The bank is confirmed per room; do not overwrite it here.
            }
          : participant
      ),
    };
  }

  if (!addIfMissing) return party;
  return {
    ...party,
    participants: [...(party.participants || []), user],
  };
}

interface PartyState {
  isHydrated: boolean;
  session: AuthSession | null;
  currentParty: PartyEvent;
  history: PartyEvent[];
  lastCloudSyncAt: string | null;

  // Hydration & authentication
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  logout: () => void;
  updateCurrentUser: (data: {
    name: string;
    phone: string;
    bank: string;
    avatarUrl?: string | null;
    newPassword?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateAvatar: (avatarUrl: string | null) => Promise<{ success: boolean; error?: string }>;

  // Party general actions
  setPartyTitle: (title: string) => void;
  syncPartyFromCloud: (partyData: Partial<PartyEvent>) => void;
  syncWithCloud: (options?: {
    background?: boolean;
  }) => Promise<{ success: boolean; error?: string; stale?: boolean }>;
  resetParty: () => void;
  leaveParty: () => Promise<{ success: boolean; error?: string }>;

  // Expense items actions
  addExpense: (
    title: string,
    amount: number,
    paidById: string,
    splitUserIds: string[],
    category?: ItemCategory
  ) => ExpenseItem | null;
  updateExpense: (id: string, updates: Partial<ExpenseItem>) => void;
  removeExpense: (id: string) => void;

  // Shopping list actions
  addShoppingItem: (
    title: string,
    estimatedAmount?: number,
    assignedUserId?: string,
    category?: ItemCategory
  ) => ShoppingItem | null;
  updateShoppingItem: (id: string, updates: Partial<ShoppingItem>) => void;
  deleteShoppingItem: (id: string) => void;
  toggleClaimShoppingItem: (id: string) => void;
  convertShoppingItemToExpense: (
    id: string,
    actualAmount: number,
    paidById: string,
    splitUserIds: string[]
  ) => Promise<ExpenseItem | null>;
  unconvertShoppingItem: (id: string) => void;

  // Settlement actions
  toggleTransferSettled: (
    transfer: SimplifiedDebtTransfer
  ) => Promise<{ success: boolean; error?: string }>;

  // History actions
  saveCurrentPartyToHistory: () => void;
  deleteHistoryParty: (partyId: string) => void;
}

export const usePartyStore = create<PartyState>((set, get) => ({
  isHydrated: false,
  session: null,
  currentParty: createDefaultParty(),
  history: [],
  lastCloudSyncAt: null,

  hydrate: async () => {
    const [storedSession, storedParty, storedHistory, legacyProfilesRaw] = await Promise.all([
      loadItem<unknown>(STORAGE_KEYS.AUTH_SESSION, null),
      loadItem<unknown>(STORAGE_KEYS.CURRENT_PARTY, null),
      loadItem<unknown>(STORAGE_KEYS.PARTY_HISTORY, []),
      loadItem<unknown>(STORAGE_KEYS.PROFILES, null),
    ]);

    const session = normalizeSession(storedSession);
    const legacyProfiles = normalizeLegacyProfiles(legacyProfilesRaw);

    let party = normalizePartyEvent(storedParty, undefined, legacyProfiles);
    const history = Array.isArray(storedHistory)
      ? storedHistory
          .map((entry) => normalizePartyEvent(entry, undefined, legacyProfiles))
          .filter((entry): entry is PartyEvent => Boolean(entry))
          .map((entry) => (entry.code ? entry : removeDemoData(entry)))
      : [];

    if (!party) {
      party = createDefaultParty();
    } else if (!party.code) {
      party = removeDemoData(party);
    }

    // A local room always contains its authenticated owner; for cloud rooms, refresh the owner's avatar/profile
    if (session) {
      party = refreshSelfInParty(party, session.user, !party.code);
    }

    await Promise.all([
      saveItem(STORAGE_KEYS.AUTH_SESSION, session),
      saveItem(STORAGE_KEYS.CURRENT_PARTY, party),
    ]);

    set({
      isHydrated: true,
      session,
      currentParty: party,
      history,
    });
  },

  setSession: (nextSession) => {
    const user: UserProfile = {
      ...nextSession.user,
      bank: normalizeBank(nextSession.user.bank),
      avatarColor:
        nextSession.user.avatarColor || getAvatarColor(nextSession.user.name || 'Участник'),
    };
    const session = { ...nextSession, user };

    // setSession is only called from the auth screen, i.e. when there was no
    // active session. Start from a clean local room so data from a previously
    // signed-in account can never leak into the new account. Shared rooms are
    // rejoined by code after login.
    const party = refreshSelfInParty(createDefaultParty(), user, true);

    set({ session, currentParty: party, lastCloudSyncAt: null });
    void saveItem(STORAGE_KEYS.AUTH_SESSION, session);
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, party);
  },

  logout: () => {
    const freshParty = createDefaultParty();
    set({ session: null, currentParty: freshParty, lastCloudSyncAt: null });
    void saveItem(STORAGE_KEYS.AUTH_SESSION, null);
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, freshParty);
  },

  updateCurrentUser: async (data) => {
    const { session, currentParty } = get();
    if (!session) return { success: false, error: 'Требуется авторизация' };

    const nextAvatarUrl =
      data.avatarUrl === null
        ? undefined
        : data.avatarUrl !== undefined
        ? data.avatarUrl
        : session.user.avatarUrl;

    // Optimistic user state
    const optimisticUser: UserProfile = {
      ...session.user,
      name: data.name,
      phone: data.phone,
      bank: normalizeBank(data.bank),
      avatarColor: session.user.avatarColor || getAvatarColor(data.name),
      avatarUrl: nextAvatarUrl,
    };
    const optimisticSession = { ...session, user: optimisticUser };
    const optimisticParty = refreshSelfInParty(currentParty, optimisticUser, true);

    // If no password change, update store & storage immediately and sync in background
    if (!data.newPassword) {
      set({ session: optimisticSession, currentParty: optimisticParty });
      void saveItem(STORAGE_KEYS.AUTH_SESSION, optimisticSession);
      void saveItem(STORAGE_KEYS.CURRENT_PARTY, optimisticParty);

      queueUpdateUserProfileInCloud(
        { userId: session.user.id, token: session.token },
        {
          name: data.name,
          phone: data.phone,
          bank: data.bank,
          avatarUrl: optimisticUser.avatarUrl,
          partyId: currentParty?.id,
        },
        {
          failureMessage: 'Не удалось синхронизировать профиль с сервером',
          onFailure: () => {
            // Keep local optimistic profile/avatar; do not roll back and erase user avatar
          },
        }
      );

      return { success: true };
    }

    // With password change: await server confirmation
    const res = await updateUserProfileInCloud(
      { userId: session.user.id, token: session.token },
      {
        ...data,
        avatarUrl: optimisticUser.avatarUrl,
        partyId: currentParty?.id,
      }
    );
    if (!res.success || !res.user) {
      return { success: false, error: res.error || 'Не удалось обновить профиль' };
    }

    const updatedUser: UserProfile = {
      ...session.user,
      ...res.user,
      bank: normalizeBank(res.user.bank),
      avatarColor: session.user.avatarColor || getAvatarColor(res.user.name),
      avatarUrl: optimisticUser.avatarUrl || res.user.avatarUrl,
    };
    const updatedSession = { ...session, user: updatedUser };

    const updatedParty = refreshSelfInParty(currentParty, updatedUser, true);

    set({ session: updatedSession, currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.AUTH_SESSION, updatedSession);
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    return { success: true };
  },

  updateAvatar: async (avatarUrl: string | null) => {
    const { session, updateCurrentUser } = get();
    if (!session) return { success: false, error: 'Требуется авторизация' };
    return updateCurrentUser({
      name: session.user.name,
      phone: session.user.phone,
      bank: session.user.bank,
      avatarUrl,
    });
  },

  setPartyTitle: (title) => {
    const currentParty = get().currentParty;
    const previousTitle = currentParty.title;
    const updatedParty = { ...currentParty, title };
    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    const stateKey = updatedParty.id;
    const state: TitleUpdateState = titleUpdateStates.get(stateKey) || {
      lastPersisted: previousTitle,
      latest: title,
      pending: 0,
    };
    state.latest = title;
    state.pending += 1;
    titleUpdateStates.set(stateKey, state);

    const session = get().session;
    if (!updatedParty.code || !title.trim() || !session) {
      state.pending -= 1;
      if (state.pending <= 0) titleUpdateStates.delete(stateKey);
      return;
    }

    queueUpdatePartyTitleInCloud(
      updatedParty.id,
      title.trim(),
      { userId: session.user.id, token: session.token },
      {
        onSuccess: () => {
          const current = titleUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          current.lastPersisted = title.trim();
          if (current.pending === 0) titleUpdateStates.delete(stateKey);
        },
        onFailure: () => {
          const current = titleUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          if (current.pending > 0) return;

          titleUpdateStates.delete(stateKey);
          const latest = get().currentParty;
          if (latest.id === updatedParty.id && latest.title === current.latest) {
            const reverted = { ...latest, title: current.lastPersisted };
            set({ currentParty: reverted });
            void saveItem(STORAGE_KEYS.CURRENT_PARTY, reverted);
          }
        },
      }
    );
  },

  syncPartyFromCloud: (partyData) => {
    const current = get().currentParty;
    let mergedParty =
      normalizePartyEvent(
        {
          ...current,
          ...partyData,
          id: partyData.id || current.id,
          title: partyData.title ?? current.title,
          date: partyData.date ?? current.date,
          participants: partyData.participants ?? current.participants,
          expenses: partyData.expenses ?? current.expenses,
          shoppingList: partyData.shoppingList ?? current.shoppingList,
          settledTransferIds:
            partyData.settledTransferIds ?? current.settledTransferIds,
          deletedExpenseIds: partyData.deletedExpenseIds ?? current.deletedExpenseIds,
          pendingExpenseIds: partyData.pendingExpenseIds ?? current.pendingExpenseIds,
        },
        current.id
      ) || current;

    // Preserve the current user's profile and avatar in mergedParty so background polling never blanks it out
    const sessionUser = get().session?.user;
    if (sessionUser) {
      mergedParty = refreshSelfInParty(mergedParty, sessionUser, false);
    }

    const syncedAt = new Date().toISOString();
    if (partySignature(current) === partySignature(mergedParty)) {
      // Most 8-second polls return the same room. Update the timestamp without
      // replacing the store object, so screens do not rerender and AsyncStorage
      // is not rewritten for identical data.
      set({ lastCloudSyncAt: syncedAt });
      return;
    }

    const currentUser = get().session?.user;
    if (currentUser) {
      const wasInParty = (current.participants || []).some((p) => p.id === currentUser.id);
      const nowInParty = (mergedParty.participants || []).some((p) => p.id === currentUser.id);
      if (!wasInParty && nowInParty) {
        const userShare = (mergedParty.expenses || []).reduce((acc, exp) => {
          const splits = exp.splitBetween || [];
          const isIncluded = splits.some((s) => s.userId === currentUser.id);
          if (isIncluded && splits.length > 0) {
            return acc + exp.amount / splits.length;
          }
          return acc;
        }, 0);

        useNotificationStore.getState().dispatchNotification('party_invite', {
          partyTitle: mergedParty.title,
          partyId: mergedParty.id,
          amount: userShare > 0 ? userShare : undefined,
        });
      }

      // Check if newly settled payments occurred
      const prevSettled = new Set(current.settledTransferIds || []);
      const newSettledIds = (mergedParty.settledTransferIds || []).filter(
        (id) => !prevSettled.has(id)
      );
      if (newSettledIds.length > 0 && (current.settledTransferIds || []).length > 0) {
        useNotificationStore.getState().dispatchNotification('payment_status', {
          partyTitle: mergedParty.title,
          partyId: mergedParty.id,
        });
      }

      // Check if expenses changed for participants of those cheques
      if (current.expenses && mergedParty.expenses) {
        const prevExpenses = current.expenses;
        const nextExpenses = mergedParty.expenses;
        const prevMap = new Map(prevExpenses.map((e) => [e.id, e]));
        const nextMap = new Map(nextExpenses.map((e) => [e.id, e]));
        const pendingIds = new Set(current.pendingExpenseIds || []);
        const deletedIds = new Set(current.deletedExpenseIds || []);

        const isUserParticipant = (exp: ExpenseItem) => {
          return (
            exp.paidById === currentUser.id ||
            (exp.splitBetween || []).some((s) => s.userId === currentUser.id)
          );
        };

        // 1. Newly added cheques where current user is a participant
        for (const nextExp of nextExpenses) {
          if (!prevMap.has(nextExp.id) && !pendingIds.has(nextExp.id)) {
            if (isUserParticipant(nextExp)) {
              const splits = nextExp.splitBetween || [];
              const isIncluded = splits.some((s) => s.userId === currentUser.id);
              const share =
                isIncluded && splits.length > 0
                  ? Math.round(nextExp.amount / splits.length)
                  : undefined;

              useNotificationStore.getState().dispatchNotification('bill_change', {
                partyTitle: mergedParty.title,
                partyId: mergedParty.id,
                amount: share,
                customMessage:
                  isIncluded && share
                    ? `В чек «${nextExp.title}» добавлена ваша доля: ${share} ₽ (общая сумма: ${formatRubles(nextExp.amount)})`
                    : `В счёте «${mergedParty.title}» добавлен чек «${nextExp.title}» (${formatRubles(nextExp.amount)})`,
              });
            }
          }
        }

        // 2. Modified cheques where current user was or is a participant
        for (const nextExp of nextExpenses) {
          const prevExp = prevMap.get(nextExp.id);
          if (prevExp) {
            const amountChanged = Math.abs(prevExp.amount - nextExp.amount) > 0.01;
            const titleChanged = prevExp.title !== nextExp.title;
            const payerChanged = prevExp.paidById !== nextExp.paidById;
            const prevSplits = (prevExp.splitBetween || []).map((s) => s.userId).sort().join(',');
            const nextSplits = (nextExp.splitBetween || []).map((s) => s.userId).sort().join(',');
            const splitsChanged = prevSplits !== nextSplits;

            if (amountChanged || titleChanged || payerChanged || splitsChanged) {
              const wasPart = isUserParticipant(prevExp);
              const isPart = isUserParticipant(nextExp);
              const hasLocalPending = expenseUpdateStates.has(
                expenseUpdateKey(mergedParty.id, nextExp.id)
              );

              if ((wasPart || isPart) && !hasLocalPending) {
                const splits = nextExp.splitBetween || [];
                const isIncluded = splits.some((s) => s.userId === currentUser.id);
                const share =
                  isIncluded && splits.length > 0
                    ? Math.round(nextExp.amount / splits.length)
                    : undefined;

                let changeDesc = 'обновлены данные';
                if (amountChanged && splitsChanged) {
                  changeDesc = `изменилась сумма (${formatRubles(nextExp.amount)}) и состав участников`;
                } else if (amountChanged) {
                  changeDesc = `изменилась сумма: ${formatRubles(nextExp.amount)}`;
                } else if (splitsChanged) {
                  changeDesc = isIncluded
                    ? 'вы добавлены в список скидывающихся'
                    : 'изменился состав участников';
                } else if (titleChanged) {
                  changeDesc = `переименован в «${nextExp.title}»`;
                }

                useNotificationStore.getState().dispatchNotification('bill_change', {
                  partyTitle: mergedParty.title,
                  partyId: mergedParty.id,
                  amount: share,
                  customMessage:
                    isIncluded && share
                      ? `В чеке «${nextExp.title}» ${changeDesc}. Ваша доля: ${share} ₽`
                      : `В счёте «${mergedParty.title}» по чеку «${nextExp.title}» ${changeDesc}`,
                });
              }
            }
          }
        }

        // 3. Removed cheques where current user was a participant
        for (const prevExp of prevExpenses) {
          if (!nextMap.has(prevExp.id) && !deletedIds.has(prevExp.id)) {
            if (isUserParticipant(prevExp)) {
              useNotificationStore.getState().dispatchNotification('bill_change', {
                partyTitle: mergedParty.title,
                partyId: mergedParty.id,
                customMessage: `Чек «${prevExp.title}» (${formatRubles(prevExp.amount)}) удалён из счёта «${mergedParty.title}»`,
              });
            }
          }
        }

        // 4. Newly added shopping items in the room
        if (current.shoppingList && mergedParty.shoppingList) {
          const prevShopMap = new Map((current.shoppingList || []).map((s) => [s.id, s]));
          for (const nextShop of mergedParty.shoppingList || []) {
            if (!prevShopMap.has(nextShop.id)) {
              useNotificationStore.getState().dispatchNotification('bill_change', {
                partyTitle: mergedParty.title,
                partyId: mergedParty.id,
                customMessage: `В список покупок тусы «${mergedParty.title}» добавлен товар «${nextShop.title}»`,
              });
            }
          }
        }
      }
    }

    set({ currentParty: mergedParty, lastCloudSyncAt: syncedAt });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, mergedParty);
  },
  syncWithCloud: async (options) => {
    const { currentParty, session } = get();
    if (!currentParty.code || !currentParty.id) {
      return { success: false, error: 'Комната не подключена к Google Sheets' };
    }
    if (!session) {
      return { success: false, error: 'Требуется авторизация' };
    }

    // A refresh during an optimistic write could fetch the pre-write sheet and
    // briefly revert the UI. Background polling is skipped by the hook; for a
    // manual pull, wait for the queue to drain instead of racing it.
    if (hasPendingCloudWrites()) {
      if (options?.background) {
        return { success: false, error: 'Ожидание отправки изменений' };
      }
      const drained = await waitForCloudWrites(6000);
      if (!drained) {
        return {
          success: false,
          error: 'Изменения ещё сохраняются в Google Sheets. Попробуйте обновить через несколько секунд.',
        };
      }
    }

    const auth = { userId: session.user.id, token: session.token };
    const readRevision = getCloudWriteRevision();
    const readOrder = ++syncReadSequence;
    const res = await getPartyDetailsFromCloud(
      currentParty.id,
      currentParty.code,
      auth,
      {
        // Auto-sync keeps the existing UI on screen and revalidates in the
        // background. A manual pull-to-refresh always goes to the network.
        forceRefresh: !options?.background,
        allowStale: Boolean(options?.background),
      }
    );
    if (!res.success || !res.party) {
      return { success: false, error: res.error || 'Ошибка синхронизации с Google Sheets' };
    }

    // A new optimistic write may have been queued/committed while the read was
    // in flight. Merging the older snapshot now would briefly (or permanently,
    // if the write already finished) revert it.
    if (
      hasPendingCloudWrites() ||
      getCloudWriteRevision() !== readRevision
    ) {
      return { success: false, error: 'Изменения ещё сохраняются' };
    }

    // The user may have joined another room while the request was in flight.
    const latestParty = get().currentParty;
    if (latestParty.id !== currentParty.id || latestParty.code !== currentParty.code) {
      return { success: false, error: 'Комната изменилась во время синхронизации' };
    }

    if (readOrder < lastAppliedSyncRead) {
      return { success: false, error: 'Получен устаревший снимок комнаты' };
    }

    const merged = mergeCloudParty(latestParty, res, { keepLocalOnlyExpenses: true });
    if (!merged) {
      return { success: false, error: 'Сервер вернул некорректные данные' };
    }

    if (!res.stale) lastAppliedSyncRead = readOrder;
    get().syncPartyFromCloud(merged.party);

    // Self-healing: re-upload local expenses that are missing in the sheet
    // (for example, added while offline) and retry pending deletions/edits.
    // These go through the same queue, so they are batched with other writes
    // and respect quota/backoff instead of firing in a burst. If the queue is
    // already sending a user write, skip this round: mergeCloudParty kept the
    // pending local state, and the existing queue operation is authoritative.
    if (!hasPendingCloudWrites()) {
      for (const expense of merged.pendingUpload) {
        queueAddExpenseToCloud(
          currentParty.id,
          auth,
          {
            id: expense.id,
            title: expense.title,
            amount: expense.amount,
            paidById: expense.paidById,
            sharedUserIds: (expense.splitBetween || []).map((s) => s.userId),
            category: expense.category,
          },
          {
            silent: true,
            debounceMs: 0,
            priority: -8,
            coalesceKey: `expense:add:${currentParty.id}:${expense.id}`,
          }
        );
      }
      for (const expense of merged.pendingUpdates) {
        queueUpdateExpenseToCloud(
          currentParty.id,
          auth,
          {
            id: expense.id,
            title: expense.title,
            amount: expense.amount,
            paidById: expense.paidById,
            sharedUserIds: (expense.splitBetween || []).map((s) => s.userId),
            category: expense.category,
          },
          { silent: true, debounceMs: 0, priority: -9 }
        );
      }
      for (const deletedId of merged.party.deletedExpenseIds || []) {
        queueDeleteExpenseFromCloud(deletedId, currentParty.id, auth, {
          silent: true,
          debounceMs: 0,
          priority: -8,
        });
      }
    }

    return { success: true, stale: res.stale };
  },

  resetParty: () => {
    const previousPartyId = get().currentParty.id;
    clearPendingMutationState(previousPartyId);
    let freshParty = createDefaultParty();
    const session = get().session;
    if (session) {
      freshParty = refreshSelfInParty(freshParty, session.user, true);
    }
    set({ currentParty: freshParty, lastCloudSyncAt: null });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, freshParty);
  },

  leaveParty: async () => {
    const { currentParty, session } = get();

    if (!currentParty.code || !session) {
      get().resetParty();
      return { success: true };
    }

    const leavingParty = currentParty;
    const previousSyncAt = get().lastCloudSyncAt;
    const auth = { userId: session.user.id, token: session.token };

    // Drop rollback bookkeeping for the room that is being left; its queued
    // writes are canceled below.
    clearPendingMutationState(leavingParty.id);

    // The optimistic leave must not be followed by stale writes for the room
    // the user just left. Requests already on the wire cannot be aborted, but
    // they are marked canceled so they cannot retry, roll back, or toast.
    cancelCloudWrites((operation) => operation.partyId === leavingParty.id);

    // Switch the UI immediately. The network request is queued in the
    // background with the highest priority.
    get().resetParty();
    const freshPartyId = get().currentParty.id;

    queueLeavePartyInCloud(leavingParty.id, auth, {
      failureMessage: 'Не удалось выйти из комнаты — она восстановлена',
      onFailure: () => {
        const latest = get().currentParty;
        // Restore only if the user has not started a new local bill in the
        // meantime. This makes the destructive action recoverable without
        // overwriting newer work.
        if (
          latest.id === freshPartyId &&
          !latest.code &&
          (latest.expenses || []).length === 0
        ) {
          set({ currentParty: leavingParty, lastCloudSyncAt: previousSyncAt });
          void saveItem(STORAGE_KEYS.CURRENT_PARTY, leavingParty);
        }
      },
    });

    return { success: true };
  },

  addExpense: (title, amount, paidById, splitUserIds, category = 'food') => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || amount <= 0) return null;

    const currentParty = get().currentParty;
    const { session } = get();
    if (!session) return null;

    const participantIds = new Set((currentParty.participants || []).map((p) => p.id));
    if (!participantIds.has(paidById)) return null;
    const validSplitIds = Array.from(
      new Set(splitUserIds.filter((id) => participantIds.has(id)))
    );
    if (validSplitIds.length === 0) return null;

    const newExpense: ExpenseItem = {
      id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: trimmedTitle,
      amount: Number(amount),
      paidById,
      splitBetween: validSplitIds.map((userId) => ({ userId })),
      category,
      date: new Date().toISOString(),
    };

    const updatedParty: PartyEvent = {
      ...currentParty,
      expenses: [newExpense, ...(currentParty.expenses || [])],
      // Track this cheque until Google Sheets returns it, so a refresh that
      // raced with the upload does not hide or duplicate it.
      pendingExpenseIds: Array.from(
        new Set([...(currentParty.pendingExpenseIds || []), newExpense.id])
      ),
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    // Notify about bill change
    useNotificationStore.getState().dispatchNotification('bill_change', {
      partyTitle: updatedParty.title,
      partyId: updatedParty.id,
      amount: newExpense.amount,
      actorName: session.user.name,
    });

    if (updatedParty.code) {
      queueAddExpenseToCloud(
        updatedParty.id,
        { userId: session.user.id, token: session.token },
        {
          id: newExpense.id,
          title: newExpense.title,
          amount: newExpense.amount,
          paidById: newExpense.paidById,
          sharedUserIds: validSplitIds,
          category: newExpense.category,
        },
        {
          onFailure: () => {
            const latest = get().currentParty;
            if (latest.id !== updatedParty.id) return;
            if (!(latest.expenses || []).some((expense) => expense.id === newExpense.id)) {
              return;
            }
            const reverted: PartyEvent = {
              ...latest,
              expenses: (latest.expenses || []).filter(
                (expense) => expense.id !== newExpense.id
              ),
              pendingExpenseIds: (latest.pendingExpenseIds || []).filter(
                (id) => id !== newExpense.id
              ),
            };
            set({ currentParty: reverted });
            void saveItem(STORAGE_KEYS.CURRENT_PARTY, reverted);
          },
        }
      );
    }

    return newExpense;
  },

  updateExpense: (id, updates) => {
    const currentParty = get().currentParty;
    const { session } = get();
    const previousExpense = (currentParty.expenses || []).find((e) => e.id === id);
    if (!previousExpense) return;

    const updatedExpense: ExpenseItem = { ...previousExpense, ...updates };
    const updatedParty: PartyEvent = {
      ...currentParty,
      expenses: (currentParty.expenses || []).map((e) => (e.id === id ? updatedExpense : e)),
      // Keep the local version authoritative until Google Sheets confirms it,
      // otherwise a background poll could briefly revert the edit.
      pendingExpenseIds: Array.from(
        new Set([...(currentParty.pendingExpenseIds || []), id])
      ),
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    // Notify about bill change
    useNotificationStore.getState().dispatchNotification('bill_change', {
      partyTitle: updatedParty.title,
      partyId: updatedParty.id,
      amount: updatedExpense.amount,
      actorName: session?.user?.name,
    });

    const stateKey = expenseUpdateKey(updatedParty.id, id);
    const state: ExpenseUpdateState =
      expenseUpdateStates.get(stateKey) || {
        lastPersisted: previousExpense,
        latest: updatedExpense,
        pending: 0,
      };
    state.latest = updatedExpense;
    state.pending += 1;
    expenseUpdateStates.set(stateKey, state);

    if (!updatedParty.code || !session) {
      // Local-only room: nothing was sent, so there is no server version to
      // roll back to.
      state.pending -= 1;
      if (state.pending <= 0) expenseUpdateStates.delete(stateKey);
      return;
    }

    queueUpdateExpenseToCloud(
      updatedParty.id,
      { userId: session.user.id, token: session.token },
      {
        id: updatedExpense.id,
        title: updatedExpense.title,
        amount: updatedExpense.amount,
        paidById: updatedExpense.paidById,
        sharedUserIds: (updatedExpense.splitBetween || []).map((s) => s.userId),
        category: updatedExpense.category,
      },
      {
        onSuccess: () => {
          const current = expenseUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          current.lastPersisted = updatedExpense;
          if (current.pending === 0) expenseUpdateStates.delete(stateKey);
        },
        onFailure: () => {
          const current = expenseUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          // Wait for newer edits of the same row to settle before restoring.
          if (current.pending > 0) return;

          expenseUpdateStates.delete(stateKey);
          const latest = get().currentParty;
          if (latest.id !== updatedParty.id) return;
          const currentExpense = (latest.expenses || []).find((e) => e.id === id);
          if (
            !currentExpense ||
            !isSameExpenseSnapshot(currentExpense, current.latest)
          ) {
            return;
          }

          const reverted: PartyEvent = {
            ...latest,
            expenses: (latest.expenses || []).map((e) =>
              e.id === id ? current.lastPersisted : e
            ),
            // Keep the restored row pending until a poll confirms it; this
            // also lets self-healing retry an update that never reached Sheets.
            pendingExpenseIds: Array.from(
              new Set([...(latest.pendingExpenseIds || []), id])
            ),
          };
          set({ currentParty: reverted });
          void saveItem(STORAGE_KEYS.CURRENT_PARTY, reverted);
        },
      }
    );
  },

  removeExpense: (id) => {
    const currentParty = get().currentParty;
    const { session } = get();
    const removedIndex = Math.max(
      0,
      (currentParty.expenses || []).findIndex((e) => e.id === id)
    );
    const removedExpense = (currentParty.expenses || []).find((e) => e.id === id);
    // Deleting supersedes any pending update; a failed delete will restore the
    // local row as pending so self-healing can reconcile it with Sheets.
    expenseUpdateStates.delete(expenseUpdateKey(currentParty.id, id));
    const updatedParty: PartyEvent = {
      ...currentParty,
      expenses: (currentParty.expenses || []).filter((e) => e.id !== id),
      // Remember the deletion until Google Sheets confirms it, otherwise the
      // next background refresh would bring the cheque back.
      deletedExpenseIds: Array.from(
        new Set([...(currentParty.deletedExpenseIds || []), id])
      ),
      // A deleted cheque must not be re-uploaded by the self-healing sync.
      pendingExpenseIds: (currentParty.pendingExpenseIds || []).filter(
        (pendingId) => pendingId !== id
      ),
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    // Notify about bill change
    useNotificationStore.getState().dispatchNotification('bill_change', {
      partyTitle: updatedParty.title,
      partyId: updatedParty.id,
      customMessage: removedExpense
        ? `В счёте «${updatedParty.title}» удалена позиция «${removedExpense.title}»`
        : `В счёте «${updatedParty.title}» удалена позиция`,
    });

    if (updatedParty.code && session) {
      queueDeleteExpenseFromCloud(
        id,
        updatedParty.id,
        { userId: session.user.id, token: session.token },
        {
          onFailure: () => {
            const latest = get().currentParty;
            if (latest.id !== updatedParty.id) return;
            if ((latest.expenses || []).some((e) => e.id === id)) return;

            const restoredExpenses = [...(latest.expenses || [])];
            if (removedExpense) {
              restoredExpenses.splice(
                Math.min(removedIndex, restoredExpenses.length),
                0,
                removedExpense
              );
            }
            const reverted: PartyEvent = {
              ...latest,
              expenses: restoredExpenses,
              deletedExpenseIds: (latest.deletedExpenseIds || []).filter(
                (deletedId) => deletedId !== id
              ),
              pendingExpenseIds: Array.from(
                new Set([...(latest.pendingExpenseIds || []), id])
              ),
            };
            set({ currentParty: reverted });
            void saveItem(STORAGE_KEYS.CURRENT_PARTY, reverted);
          },
        }
      );
    }
  },

  addShoppingItem: (title, estimatedAmount, assignedUserId, category = 'food') => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return null;

    const currentParty = get().currentParty;
    const session = get().session;

    const newItem: ShoppingItem = {
      id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: trimmedTitle,
      estimatedAmount:
        estimatedAmount && estimatedAmount > 0 ? Number(estimatedAmount) : undefined,
      assignedUserId: assignedUserId || undefined,
      isBought: false,
      category: VALID_CATEGORIES.includes(category) ? category : undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedShoppingList = [newItem, ...(currentParty.shoppingList || [])];
    const updatedParty: PartyEvent = {
      ...currentParty,
      shoppingList: updatedShoppingList,
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    if (updatedParty.code && session) {
      queueAddShoppingItemToCloud(
        updatedParty.id,
        { userId: session.user.id, token: session.token },
        {
          id: newItem.id,
          title: newItem.title,
          estimatedAmount: newItem.estimatedAmount,
          assignedUserId: newItem.assignedUserId,
          category: newItem.category,
        }
      );
      flushOfflineQueue();
    }

    return newItem;
  },

  updateShoppingItem: (id, updates) => {
    const currentParty = get().currentParty;
    const currentItems = currentParty.shoppingList || [];
    const existingIndex = currentItems.findIndex((s) => s.id === id);
    if (existingIndex === -1) return;

    const updatedItem: ShoppingItem = {
      ...currentItems[existingIndex],
      ...updates,
      id,
    };

    const updatedShoppingList = [...currentItems];
    updatedShoppingList[existingIndex] = updatedItem;

    const updatedParty: PartyEvent = {
      ...currentParty,
      shoppingList: updatedShoppingList,
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    const session = get().session;
    if (updatedParty.code && session) {
      queueUpdateShoppingItemToCloud(
        updatedParty.id,
        { userId: session.user.id, token: session.token },
        {
          id: updatedItem.id,
          title: updatedItem.title,
          estimatedAmount: updatedItem.estimatedAmount,
          assignedUserId: updatedItem.assignedUserId,
          isBought: updatedItem.isBought,
          boughtById: updatedItem.boughtById,
          actualAmount: updatedItem.actualAmount,
          convertedExpenseId: updatedItem.convertedExpenseId,
          category: updatedItem.category,
        }
      );
      flushOfflineQueue();
    }
  },

  deleteShoppingItem: (id) => {
    const currentParty = get().currentParty;
    const currentItems = currentParty.shoppingList || [];
    const itemToDelete = currentItems.find((s) => s.id === id);
    if (!itemToDelete) return;

    if (itemToDelete.convertedExpenseId) {
      get().removeExpense(itemToDelete.convertedExpenseId);
    }

    const updatedShoppingList = currentItems.filter((s) => s.id !== id);
    const updatedParty: PartyEvent = {
      ...currentParty,
      shoppingList: updatedShoppingList,
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    const session = get().session;
    if (updatedParty.code && session) {
      queueDeleteShoppingItemFromCloud(
        id,
        updatedParty.id,
        { userId: session.user.id, token: session.token }
      );
      flushOfflineQueue();
    }
  },

  toggleClaimShoppingItem: (id) => {
    const currentParty = get().currentParty;
    const session = get().session;
    if (!session) return;

    const item = (currentParty.shoppingList || []).find((s) => s.id === id);
    if (!item) return;

    const currentUserId = session.user.id;
    const newAssignedId = item.assignedUserId === currentUserId ? undefined : currentUserId;

    get().updateShoppingItem(id, { assignedUserId: newAssignedId });
  },

  convertShoppingItemToExpense: async (id, actualAmount, paidById, splitUserIds) => {
    const currentParty = get().currentParty;
    const item = (currentParty.shoppingList || []).find((s) => s.id === id);
    if (!item) return null;

    const newExpense = get().addExpense(
      item.title,
      actualAmount,
      paidById,
      splitUserIds,
      item.category || 'food'
    );
    if (!newExpense) return null;

    get().updateShoppingItem(id, {
      isBought: true,
      boughtById: paidById,
      actualAmount,
      convertedExpenseId: newExpense.id,
    });

    return newExpense;
  },

  unconvertShoppingItem: (id) => {
    const currentParty = get().currentParty;
    const item = (currentParty.shoppingList || []).find((s) => s.id === id);
    if (!item) return;

    if (item.convertedExpenseId) {
      get().removeExpense(item.convertedExpenseId);
    }

    get().updateShoppingItem(id, {
      isBought: false,
      boughtById: undefined,
      actualAmount: undefined,
      convertedExpenseId: undefined,
    });
  },

  toggleTransferSettled: async (transfer) => {
    const currentParty = get().currentParty;
    const currentSettled = currentParty.settledTransferIds || [];
    const wasSettled = currentSettled.includes(transfer.id);
    const nextPaid = !wasSettled;
    const updatedSettled = nextPaid
      ? Array.from(new Set([...currentSettled, transfer.id]))
      : currentSettled.filter((id) => id !== transfer.id);

    const updatedParty: PartyEvent = {
      ...currentParty,
      settledTransferIds: updatedSettled,
    };

    set({ currentParty: updatedParty });
    void saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    if (nextPaid) {
      useNotificationStore.getState().dispatchNotification('payment_status', {
        partyTitle: currentParty.title,
        partyId: currentParty.id,
        amount: transfer.amount,
        actorName: transfer.fromUser.name,
      });
    }

    const stateKey = transferUpdateKey(updatedParty.id, transfer.id);
    const state: TransferUpdateState = transferUpdateStates.get(stateKey) || {
      lastPersisted: wasSettled,
      desired: nextPaid,
      pending: 0,
    };
    state.desired = nextPaid;
    state.pending += 1;
    transferUpdateStates.set(stateKey, state);

    const { session } = get();
    if (!updatedParty.code || !session) {
      state.pending -= 1;
      if (state.pending <= 0) transferUpdateStates.delete(stateKey);
      if (!updatedParty.code) return { success: true };
      // No cloud room / session race: undo the optimistic toggle immediately.
      const latest = get().currentParty;
      if (latest.id === updatedParty.id) {
        const reverted: PartyEvent = {
          ...latest,
          settledTransferIds: currentSettled,
        };
        set({ currentParty: reverted });
        void saveItem(STORAGE_KEYS.CURRENT_PARTY, reverted);
      }
      return { success: false, error: 'Требуется авторизация' };
    }

    // The UI is already updated; this promise resolves immediately. The queue
    // retries transient failures and only then rolls the toggle back.
    queueSetTransferStatusInCloud(
      updatedParty.id,
      { userId: session.user.id, token: session.token },
      {
        transferId: transfer.id,
        fromUserId: transfer.fromUser.id,
        toUserId: transfer.toUser.id,
        amount: transfer.amount,
        isPaid: nextPaid,
      },
      {
        onSuccess: () => {
          const current = transferUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          current.lastPersisted = nextPaid;
          if (current.pending === 0) transferUpdateStates.delete(stateKey);
        },
        onFailure: () => {
          const current = transferUpdateStates.get(stateKey);
          if (!current) return;
          current.pending = Math.max(0, current.pending - 1);
          // A newer tap for this transfer is still in flight; let it decide.
          if (current.pending > 0) return;

          transferUpdateStates.delete(stateKey);
          const latest = get().currentParty;
          if (latest.id !== updatedParty.id) return;

          const currentlySettled = (latest.settledTransferIds || []).includes(
            transfer.id
          );
          // Do not overwrite a newer state that arrived from elsewhere.
          if (currentlySettled !== current.desired) return;

          const revertedSettled = current.lastPersisted
            ? Array.from(new Set([...(latest.settledTransferIds || []), transfer.id]))
            : (latest.settledTransferIds || []).filter((id) => id !== transfer.id);
          const revertedParty = { ...latest, settledTransferIds: revertedSettled };
          set({ currentParty: revertedParty });
          void saveItem(STORAGE_KEYS.CURRENT_PARTY, revertedParty);
        },
      }
    );
    flushOfflineQueue();

    return { success: true };
  },

  saveCurrentPartyToHistory: () => {
    const currentParty = get().currentParty;
    if (
      (currentParty.expenses || []).length === 0 &&
      (currentParty.participants || []).length === 0
    ) {
      return;
    }

    const history = get().history;
    const filtered = history.filter((p) => p.id !== currentParty.id);
    const updatedHistory = [{ ...currentParty, date: new Date().toISOString() }, ...filtered];

    set({ history: updatedHistory });
    void saveItem(STORAGE_KEYS.PARTY_HISTORY, updatedHistory);

    useNotificationStore.getState().dispatchNotification('party_closed', {
      partyTitle: currentParty.title,
      partyId: currentParty.id,
    });
  },

  deleteHistoryParty: (partyId) => {
    const updatedHistory = get().history.filter((p) => p.id !== partyId);
    set({ history: updatedHistory });
    void saveItem(STORAGE_KEYS.PARTY_HISTORY, updatedHistory);
  },
}));
