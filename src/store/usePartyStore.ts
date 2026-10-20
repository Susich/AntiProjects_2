import { create } from 'zustand';
import {
  ExpenseItem,
  ItemCategory,
  ParticipantProfile,
  PartyEvent,
} from '../types';
import { getAvatarColor } from '../utils/currency';
import { mergeCloudParty, toCloudMember } from '../utils/cloudSync';
import {
  addExpenseToCloud,
  deleteExpenseFromCloud,
  getPartyDetailsFromCloud,
  removePartyMemberFromCloud,
  syncPartyMembersInCloud,
  updateExpenseInCloud,
  updatePartyTitleInCloud,
} from '../api/googleSheets';
import { loadItem, saveItem, STORAGE_KEYS } from './storage';

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

function normalizeProfile(raw: unknown): ParticipantProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const id = asString(item.id);
  if (!id) return null;

  const name = asString(item.name) || 'Участник';
  const paymentInfo =
    item.paymentInfo && typeof item.paymentInfo === 'object' ? item.paymentInfo : {};

  return {
    id,
    name,
    avatarColor: asString(item.avatarColor) || getAvatarColor(name),
    avatarUrl: asString(item.avatarUrl) || undefined,
    paymentInfo: {
      // Keep phone as a string even if old storage / cloud had a number.
      phone: asString(paymentInfo.phone),
      sbpQrOrUrl: asString(paymentInfo.sbpQrOrUrl) || undefined,
    },
  };
}

function normalizeProfiles(raw: unknown): ParticipantProfile[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const profiles: ParticipantProfile[] = [];

  raw.forEach((entry) => {
    const profile = normalizeProfile(entry);
    if (profile && !seen.has(profile.id)) {
      seen.add(profile.id);
      profiles.push(profile);
    }
  });

  return profiles;
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

function normalizePartyEvent(raw: unknown, fallbackId?: string): PartyEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, any>;
  const participantsSource = Array.isArray(item.participants) ? item.participants : [];
  const participants = Array.from(
    new Set(
      participantsSource
        .map((entry: unknown) =>
          typeof entry === 'object' && entry !== null
            ? asString((entry as Record<string, unknown>).id)
            : asString(entry)
        )
        .filter(Boolean)
    )
  );

  return {
    id: asString(item.id) || fallbackId || `party_${Date.now()}`,
    code: asString(item.code).toUpperCase() || undefined,
    title: asString(item.title) || 'Тусовка',
    date: asString(item.date) || new Date().toISOString(),
    createdBy: asString(item.createdBy) || undefined,
    participants,
    expenses: normalizeExpenses(item.expenses),
    settledTransferIds: asStringArray(item.settledTransferIds),
    deletedExpenseIds: asStringArray(item.deletedExpenseIds),
    pendingExpenseIds: asStringArray(item.pendingExpenseIds),
  };
}

function removeDemoData(party: PartyEvent): PartyEvent {
  const removedParticipantIds = new Set(
    (party.participants || []).filter((id) => DEMO_PROFILE_IDS.includes(id))
  );
  const participants = (party.participants || []).filter(
    (id) => !removedParticipantIds.has(id)
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

interface PartyState {
  isHydrated: boolean;
  savedProfiles: ParticipantProfile[];
  myProfileId: string | null;
  currentParty: PartyEvent;
  history: PartyEvent[];
  lastCloudSyncAt: string | null;

  // Hydration
  hydrate: () => Promise<void>;

  // Profile actions
  addProfile: (profile: Omit<ParticipantProfile, 'id'>) => ParticipantProfile;
  updateProfile: (id: string, updates: Partial<ParticipantProfile>) => void;
  deleteProfile: (id: string) => void;
  setMyProfile: (id: string | null) => void;

  // Party general actions
  setPartyTitle: (title: string) => void;
  setPartyCode: (code: string) => void;
  syncPartyFromCloud: (partyData: Partial<PartyEvent>, newProfiles?: ParticipantProfile[]) => void;
  syncWithCloud: () => Promise<{ success: boolean; error?: string }>;
  resetParty: () => void;

  // Participant in party actions
  addParticipantToParty: (profileId: string) => void;
  removeParticipantFromParty: (profileId: string) => void;

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

  // Settlement actions
  toggleTransferSettled: (transferId: string) => void;

  // History actions
  saveCurrentPartyToHistory: () => void;
  loadPartyFromHistory: (partyId: string) => void;
  deleteHistoryParty: (partyId: string) => void;
}

export const INITIAL_PROFILES: ParticipantProfile[] = [];

function createDefaultParty(): PartyEvent {
  return {
    id: `party_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: 'Новая тусовка',
    date: new Date().toISOString(),
    participants: [],
    expenses: [],
    settledTransferIds: [],
    deletedExpenseIds: [],
    pendingExpenseIds: [],
  };
}

export const usePartyStore = create<PartyState>((set, get) => ({
  isHydrated: false,
  savedProfiles: INITIAL_PROFILES,
  myProfileId: null,
  currentParty: createDefaultParty(),
  history: [],
  lastCloudSyncAt: null,

  hydrate: async () => {
    // Attempt loading new v2 profiles & party. Everything loaded from storage
    // is normalized because old versions (and cloud sync) could contain
    // numeric phones or missing arrays, which used to crash on launch.
    const storedProfiles = await loadItem<unknown>(STORAGE_KEYS.PROFILES, null);
    const storedParty = await loadItem<unknown>(STORAGE_KEYS.CURRENT_PARTY, null);
    let party = normalizePartyEvent(storedParty);

    const storedHistory = await loadItem<unknown>(STORAGE_KEYS.PARTY_HISTORY, []);
    const history = Array.isArray(storedHistory)
      ? storedHistory
          .map((entry) => normalizePartyEvent(entry))
          .filter((entry): entry is PartyEvent => Boolean(entry))
      : [];

    // A cloud room is authoritative: demo-looking members that are still in
    // its participant list were uploaded to the sheet and must stay. Local
    // (not yet shared) rooms lose every trace of the old demo seed.
    const isCloudRoom = Boolean(party?.code);
    const cloudParticipantIds = new Set(party?.participants || []);
    const shouldDropDemoProfile = (id: string) =>
      DEMO_PROFILE_IDS.includes(id) &&
      (!isCloudRoom || !cloudParticipantIds.has(id));

    let profiles = normalizeProfiles(storedProfiles).filter(
      (profile) => !shouldDropDemoProfile(profile.id)
    );

    // Automatic migration from legacy v1 format if needed.
    if (profiles.length === 0) {
      const legacyFriends = await loadItem<{ id: string; name: string; phone?: string; avatarColor?: string }[] | null>(
        STORAGE_KEYS.LEGACY_SAVED_FRIENDS,
        null
      );
      const legacyOrganizer = await loadItem<{ ownerName?: string; phone?: string; customCollectionUrl?: string } | null>(
        STORAGE_KEYS.LEGACY_PAYMENT_PROFILE,
        null
      );

      if (legacyFriends && legacyFriends.length > 0) {
        profiles = normalizeProfiles(
          legacyFriends.map((f, idx) => ({
            id: f.id || `user_${idx}`,
            name: f.name,
            avatarColor: f.avatarColor || getAvatarColor(f.name),
            paymentInfo: {
              phone: f.phone || '',
              sbpQrOrUrl:
                idx === 0 && legacyOrganizer?.customCollectionUrl
                  ? legacyOrganizer.customCollectionUrl
                  : undefined,
            },
          }))
        ).filter((profile) => !shouldDropDemoProfile(profile.id));
      } else {
        profiles = [];
      }
    }

    if (party) {
      party = isCloudRoom ? party : removeDemoData(party);
    } else {
      party = createDefaultParty();
    }

    // The profile that belongs to this device. Older builds implicitly used
    // the first saved profile, so keep that as a migration fallback, but
    // prefer a real profile over the old demo seed.
    const storedMyProfileId = asString(
      await loadItem<unknown>(STORAGE_KEYS.CURRENT_USER_ID, null)
    );
    const preferredProfile =
      profiles.find((profile) => !DEMO_PROFILE_IDS.includes(profile.id)) ||
      profiles[0];
    const myProfileId =
      (storedMyProfileId && profiles.some((p) => p.id === storedMyProfileId)
        ? storedMyProfileId
        : null) ??
      preferredProfile?.id ??
      null;

    await Promise.all([
      saveItem(STORAGE_KEYS.PROFILES, profiles),
      saveItem(STORAGE_KEYS.CURRENT_PARTY, party),
      saveItem(STORAGE_KEYS.CURRENT_USER_ID, myProfileId),
    ]);

    set({
      isHydrated: true,
      savedProfiles: profiles,
      myProfileId,
      currentParty: party,
      history,
    });
  },

  addProfile: (profileData) => {
    const trimmedName = profileData.name.trim();
    const newProfile: ParticipantProfile = {
      ...profileData,
      id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      avatarColor: profileData.avatarColor || getAvatarColor(trimmedName),
      paymentInfo: {
        ...profileData.paymentInfo,
        phone: String(profileData.paymentInfo.phone || '').trim(),
        sbpQrOrUrl: String(profileData.paymentInfo.sbpQrOrUrl || '').trim() || undefined,
      },
    };

    const updatedProfiles = [...get().savedProfiles, newProfile];
    set({ savedProfiles: updatedProfiles });
    saveItem(STORAGE_KEYS.PROFILES, updatedProfiles);
    return newProfile;
  },

  updateProfile: (id, updates) => {
    const updatedProfiles = get().savedProfiles.map((p) => {
      if (p.id !== id) return p;
      return (
        normalizeProfile({
          ...p,
          ...updates,
          paymentInfo: {
            ...p.paymentInfo,
            ...(updates.paymentInfo || {}),
          },
        }) || p
      );
    });

    set({ savedProfiles: updatedProfiles });
    saveItem(STORAGE_KEYS.PROFILES, updatedProfiles);

    // If this participant is in the cloud room, push the fresh requisites so
    // other devices see the updated phone / SBP link.
    const updated = updatedProfiles.find((p) => p.id === id);
    const party = get().currentParty;
    if (updated && party.code && (party.participants || []).includes(id)) {
      void syncPartyMembersInCloud(party.id, [toCloudMember(updated)]);
    }
  },

  deleteProfile: (id) => {
    const updatedProfiles = get().savedProfiles.filter((p) => p.id !== id);
    const isMyProfile = get().myProfileId === id;
    set({
      savedProfiles: updatedProfiles,
      ...(isMyProfile ? { myProfileId: null } : {}),
    });
    saveItem(STORAGE_KEYS.PROFILES, updatedProfiles);
    if (isMyProfile) {
      saveItem(STORAGE_KEYS.CURRENT_USER_ID, null);
    }

    // Also remove from current party if present
    const currentParty = get().currentParty;
    if ((currentParty.participants || []).includes(id)) {
      get().removeParticipantFromParty(id);
    }
  },

  setMyProfile: (id) => {
    const validId =
      id && get().savedProfiles.some((profile) => profile.id === id) ? id : null;
    set({ myProfileId: validId });
    saveItem(STORAGE_KEYS.CURRENT_USER_ID, validId);
  },

  setPartyTitle: (title) => {
    const updatedParty = { ...get().currentParty, title };
    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    if (updatedParty.code && title.trim()) {
      void updatePartyTitleInCloud(updatedParty.id, title.trim());
    }
  },

  setPartyCode: (code) => {
    const updatedParty = { ...get().currentParty, code: String(code || '').toUpperCase() };
    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);
  },

  syncPartyFromCloud: (partyData, newProfiles) => {
    let updatedProfiles = get().savedProfiles;
    const normalizedIncomingProfiles = normalizeProfiles(newProfiles);

    if (normalizedIncomingProfiles.length > 0) {
      // Merge profiles without duplicates
      const map = new Map<string, ParticipantProfile>();
      updatedProfiles.forEach((p) => map.set(p.id, p));
      normalizedIncomingProfiles.forEach((p) => map.set(p.id, p));
      updatedProfiles = Array.from(map.values());
      set({ savedProfiles: updatedProfiles });
      saveItem(STORAGE_KEYS.PROFILES, updatedProfiles);
    }

    const current = get().currentParty;
    const mergedParty = normalizePartyEvent(
      {
        ...current,
        ...partyData,
        id: partyData.id || current.id,
        title: partyData.title ?? current.title,
        date: partyData.date ?? current.date,
        participants: partyData.participants ?? current.participants,
        expenses: partyData.expenses ?? current.expenses,
        settledTransferIds: partyData.settledTransferIds ?? current.settledTransferIds,
        deletedExpenseIds: partyData.deletedExpenseIds ?? current.deletedExpenseIds,
        pendingExpenseIds: partyData.pendingExpenseIds ?? current.pendingExpenseIds,
      },
      current.id
    ) || current;

    set({ currentParty: mergedParty, lastCloudSyncAt: new Date().toISOString() });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, mergedParty);
  },

  syncWithCloud: async () => {
    const { currentParty } = get();
    if (!currentParty.code || !currentParty.id) {
      return { success: false, error: 'Комната не подключена к Google Sheets' };
    }

    const res = await getPartyDetailsFromCloud(currentParty.id, currentParty.code);
    if (!res.success || !res.party) {
      return { success: false, error: res.error || 'Ошибка синхронизации с Google Sheets' };
    }

    // The user may have joined another room while the request was in flight.
    const latestParty = get().currentParty;
    if (latestParty.id !== currentParty.id || latestParty.code !== currentParty.code) {
      return { success: false, error: 'Комната изменилась во время синхронизации' };
    }

    const merged = mergeCloudParty(latestParty, res, { keepLocalOnlyExpenses: true });
    if (!merged) {
      return { success: false, error: 'Сервер вернул некорректные данные' };
    }

    get().syncPartyFromCloud(merged.party, merged.profiles);

    // Self-healing: re-upload local expenses that are missing in the sheet
    // (for example, added while offline) and retry pending deletions/edits.
    for (const expense of merged.pendingUpload) {
      void addExpenseToCloud(currentParty.id, {
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        paidById: expense.paidById,
        sharedUserIds: (expense.splitBetween || []).map((s) => s.userId),
        category: expense.category,
      });
    }
    for (const expense of merged.pendingUpdates) {
      void updateExpenseInCloud({
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        paidById: expense.paidById,
        sharedUserIds: (expense.splitBetween || []).map((s) => s.userId),
        category: expense.category,
      });
    }
    for (const deletedId of merged.party.deletedExpenseIds || []) {
      void deleteExpenseFromCloud(deletedId, currentParty.id);
    }

    return { success: true };
  },

  resetParty: () => {
    const freshParty = createDefaultParty();
    set({ currentParty: freshParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, freshParty);
  },

  addParticipantToParty: (profileId) => {
    const currentParty = get().currentParty;
    if ((currentParty.participants || []).includes(profileId)) return;

    const updatedParty: PartyEvent = {
      ...currentParty,
      participants: [...(currentParty.participants || []), profileId],
    };

    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    // Make the new participant visible to everybody else in the room.
    const profile = get().savedProfiles.find((p) => p.id === profileId);
    if (updatedParty.code && profile) {
      void syncPartyMembersInCloud(updatedParty.id, [toCloudMember(profile)]);
    }
  },

  removeParticipantFromParty: (profileId) => {
    const currentParty = get().currentParty;
    const participants = currentParty.participants || [];
    const remainingParticipants = participants.filter((id) => id !== profileId);

    const updatedParty: PartyEvent = {
      ...currentParty,
      participants: remainingParticipants,
      // Clean up participation in expenses
      expenses: (currentParty.expenses || []).map((expense) => {
        // If the payer is removed, keep expense or assign to first remaining participant
        const isPayer = expense.paidById === profileId;
        const newPayerId =
          isPayer && remainingParticipants.length > 0
            ? remainingParticipants[0]
            : expense.paidById;

        return {
          ...expense,
          paidById: newPayerId,
          splitBetween: (expense.splitBetween || []).filter((s) => s.userId !== profileId),
        };
      }),
    };

    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    if (updatedParty.code) {
      void removePartyMemberFromCloud(updatedParty.id, profileId);
    }
  },

  addExpense: (title, amount, paidById, splitUserIds, category = 'food') => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || amount <= 0) return null;

    const newExpense: ExpenseItem = {
      id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: trimmedTitle,
      amount: Number(amount),
      paidById,
      splitBetween: splitUserIds.map((userId) => ({ userId })),
      category,
      date: new Date().toISOString(),
    };

    const currentParty = get().currentParty;
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
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    return newExpense;
  },

  updateExpense: (id, updates) => {
    const currentParty = get().currentParty;
    const updatedParty: PartyEvent = {
      ...currentParty,
      expenses: (currentParty.expenses || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
      // Keep the local version authoritative until Google Sheets confirms it,
      // otherwise a background poll could briefly revert the edit.
      pendingExpenseIds: Array.from(
        new Set([...(currentParty.pendingExpenseIds || []), id])
      ),
    };

    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    // Replicate the edit to the shared sheet so other devices see it.
    const updatedExpense = (updatedParty.expenses || []).find((e) => e.id === id);
    if (updatedParty.code && updatedExpense) {
      void updateExpenseInCloud({
        id: updatedExpense.id,
        title: updatedExpense.title,
        amount: updatedExpense.amount,
        paidById: updatedExpense.paidById,
        sharedUserIds: (updatedExpense.splitBetween || []).map((s) => s.userId),
        category: updatedExpense.category,
      });
    }
  },

  removeExpense: (id) => {
    const currentParty = get().currentParty;
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
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);

    if (updatedParty.code) {
      void deleteExpenseFromCloud(id, updatedParty.id);
    }
  },

  toggleTransferSettled: (transferId) => {
    const currentParty = get().currentParty;
    const isSettled = (currentParty.settledTransferIds || []).includes(transferId);
    const updatedSettled = isSettled
      ? (currentParty.settledTransferIds || []).filter((id) => id !== transferId)
      : [...(currentParty.settledTransferIds || []), transferId];

    const updatedParty: PartyEvent = {
      ...currentParty,
      settledTransferIds: updatedSettled,
    };

    set({ currentParty: updatedParty });
    saveItem(STORAGE_KEYS.CURRENT_PARTY, updatedParty);
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
    saveItem(STORAGE_KEYS.PARTY_HISTORY, updatedHistory);
  },

  loadPartyFromHistory: (partyId) => {
    const party = get().history.find((p) => p.id === partyId);
    if (party) {
      const loadedParty = normalizePartyEvent(
        {
          ...party,
          id: `party_${Date.now()}`,
        },
        `party_${Date.now()}`
      );
      if (loadedParty) {
        set({ currentParty: loadedParty });
        saveItem(STORAGE_KEYS.CURRENT_PARTY, loadedParty);
      }
    }
  },

  deleteHistoryParty: (partyId) => {
    const updatedHistory = get().history.filter((p) => p.id !== partyId);
    set({ history: updatedHistory });
    saveItem(STORAGE_KEYS.PARTY_HISTORY, updatedHistory);
  },
}));
