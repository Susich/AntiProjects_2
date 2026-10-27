import { CloudExpense, CloudShoppingItem, PartyApiResponse } from '../api/googleSheets';
import { ExpenseItem, ItemCategory, PartyEvent, ShoppingItem, UserProfile } from '../types';
import {
  isOperationPendingForExpense,
  isOperationPendingForShoppingItem,
  isOperationPendingForTransfer,
} from '../api/cloudQueue';

const VALID_CATEGORIES: ItemCategory[] = ['food', 'drink', 'hookah', 'delivery', 'other'];

export function mapCloudParticipants(res: PartyApiResponse): UserProfile[] {
  return (res.participants || []).map((p) => ({
    id: String(p.id),
    name: String(p.name || 'Участник'),
    phone: String(p.phone ?? ''),
    bank: String(p.bank || 'Сбербанк'),
    avatarColor: p.avatarColor,
    avatarUrl: p.avatarUrl ? String(p.avatarUrl) : undefined,
  }));
}

export function mapCloudExpenses(expenses?: CloudExpense[]): ExpenseItem[] {
  const byId = new Map<string, ExpenseItem>();
  return (expenses || []).reduce<ExpenseItem[]>((acc, e) => {
    const category = String(e.category || '') as ItemCategory;
    const mapped: ExpenseItem = {
      id: String(e.id),
      title: String(e.title || 'Расход'),
      amount: Number(e.amount) || 0,
      paidById: String(e.paidById ?? ''),
      splitBetween: (e.sharedUserIds || []).map((uid) => ({ userId: String(uid) })),
      category: VALID_CATEGORIES.includes(category) ? category : undefined,
      date: e.createdAt,
    };
    if (!mapped.id) return acc;

    // Defensive id de-duplication (write races could duplicate sheet rows):
    // the later row (newer createdAt) represents the freshest state.
    const prev = byId.get(mapped.id);
    if (prev) {
      const prevMs = Date.parse(prev.date || '') || 0;
      const nextMs = Date.parse(mapped.date || '') || 0;
      if (nextMs < prevMs) return acc;
      acc.splice(acc.indexOf(prev), 1, mapped);
    } else {
      acc.push(mapped);
    }
    byId.set(mapped.id, mapped);
    return acc;
  }, []);
}

function parseShoppingBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value !== 0;
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text === 'true' || text === '1' || text === 'yes' || text === 'да';
}

function parsePositiveAmount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const normalized =
    typeof value === 'string' ? value.replace(/\s+/g, '').replace(',', '.') : value;
  const numeric = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function mapCloudShoppingList(
  items?: CloudShoppingItem[],
  partyId?: string
): ShoppingItem[] {
  const byId = new Map<string, ShoppingItem>();
  const result: ShoppingItem[] = [];
  for (const item of items || []) {
    // Defensively ignore rows that explicitly belong to another room.
    if (
      partyId &&
      item.partyId &&
      String(item.partyId).trim() !== String(partyId).trim()
    ) {
      continue;
    }
    const category = String(item.category || '') as ItemCategory;
    const mapped: ShoppingItem = {
      id: String(item.id),
      title: String(item.title || 'Покупка'),
      estimatedAmount: parsePositiveAmount(item.estimatedAmount),
      assignedUserId: item.assignedUserId ? String(item.assignedUserId) : undefined,
      isBought: parseShoppingBoolean(item.isBought),
      boughtById: item.boughtById ? String(item.boughtById) : undefined,
      actualAmount: parsePositiveAmount(item.actualAmount),
      convertedExpenseId: item.convertedExpenseId ? String(item.convertedExpenseId) : undefined,
      category: VALID_CATEGORIES.includes(category) ? category : undefined,
      createdAt: item.createdAt ? String(item.createdAt) : undefined,
    };
    if (!mapped.id) continue;

    // Defensive id de-duplication (write races could duplicate sheet rows):
    // the row with the newest createdAt represents the latest intent.
    const prev = byId.get(mapped.id);
    if (prev) {
      const prevMs = Date.parse(prev.createdAt || '') || 0;
      const nextMs = Date.parse(mapped.createdAt || '') || 0;
      if (nextMs < prevMs) continue;
      result.splice(result.indexOf(prev), 1, mapped);
    } else {
      result.push(mapped);
    }
    byId.set(mapped.id, mapped);
  }
  return result;
}

function isSameExpense(a: ExpenseItem, b: ExpenseItem): boolean {
  if (a.title !== b.title) return false;
  if (Math.abs(Number(a.amount) - Number(b.amount)) > 0.001) return false;
  if (a.paidById !== b.paidById) return false;

  const normalizeIds = (expense: ExpenseItem) =>
    (expense.splitBetween || [])
      .map((split) => split.userId)
      .slice()
      .sort()
      .join(',');

  if (normalizeIds(a) !== normalizeIds(b)) return false;
  if ((a.category || '') !== (b.category || '')) return false;
  return true;
}

export interface MergedCloudParty {
  party: Partial<PartyEvent>;
  profiles: UserProfile[];
  /**
   * Local expenses that are not present in the cloud response yet. The caller
   * can push them again so an offline addition is not lost on refresh.
   */
  pendingUpload: ExpenseItem[];
  /**
   * Expenses that exist in the cloud but whose local version is newer (the
   * user edited them and the poll raced with the upload). The caller should
   * push the local version again.
   */
  pendingUpdates: ExpenseItem[];
}

/**
 * Converts a `getPartyDetails` response into the local party shape. The cloud
 * room is the shared source of truth for members, expenses and payment status.
 * There is no local profile address book: participants are the authenticated
 * users returned by the server.
 */
export function mergeCloudParty(
  local: PartyEvent,
  res: PartyApiResponse,
  options: { keepLocalOnlyExpenses?: boolean } = {}
): MergedCloudParty | null {
  if (!res.success || !res.party) return null;

  const profiles = mapCloudParticipants(res);
  const tombstoneIds = new Set(local.deletedExpenseIds || []);
  const pendingIds = new Set(local.pendingExpenseIds || []);
  const localExpensesById = new Map((local.expenses || []).map((e) => [e.id, e]));
  const rawCloudExpenses = mapCloudExpenses(res.expenses);

  // Preserve the local category if the sheet row predates category support.
  const cloudExpensesMapped = rawCloudExpenses.map((expense) => {
    const localExpense = localExpensesById.get(expense.id);
    return localExpense?.category && !expense.category
      ? { ...expense, category: localExpense.category }
      : expense;
  });
  const cloudById = new Map(cloudExpensesMapped.map((expense) => [expense.id, expense]));

  const expenses = cloudExpensesMapped
    .filter(
      (expense) =>
        !options.keepLocalOnlyExpenses || !tombstoneIds.has(expense.id)
    )
    .map((expense) => {
      if (!options.keepLocalOnlyExpenses) return expense;
      const localExpense = localExpensesById.get(expense.id);
      // A pending edit or offline mutation must not be overwritten by an older cloud snapshot.
      const hasPendingQueueMutation = isOperationPendingForExpense(local.id, expense.id);
      if (
        localExpense &&
        (pendingIds.has(expense.id) || hasPendingQueueMutation) &&
        !isSameExpense(localExpense, expense)
      ) {
        return localExpense;
      }
      return expense;
    });

  let pendingUpload: ExpenseItem[] = [];
  let pendingUpdates: ExpenseItem[] = [];
  if (options.keepLocalOnlyExpenses) {
    for (const expense of local.expenses || []) {
      const hasPendingQueueMutation = isOperationPendingForExpense(local.id, expense.id);
      if (
        (!pendingIds.has(expense.id) && !hasPendingQueueMutation) ||
        tombstoneIds.has(expense.id)
      ) {
        continue;
      }
      const cloudExpense = cloudById.get(expense.id);
      if (!cloudExpense) {
        pendingUpload.push(expense);
      } else if (!isSameExpense(expense, cloudExpense)) {
        pendingUpdates.push(expense);
      }
    }
    expenses.push(...pendingUpload);
  }

  // A tombstone is only needed while Google Sheets still contains the row.
  // The caller can retry the deletion for ids that are still present.
  const remainingTombstones = options.keepLocalOnlyExpenses
    ? (local.deletedExpenseIds || []).filter((id) => cloudById.has(id))
    : [];

  // A pending expense is confirmed as soon as the sheet returns the same data.
  // On join/create the caller deliberately replaces pending state, so the
  // tracking is only meaningful for the background refresh path.
  const remainingPending = options.keepLocalOnlyExpenses
    ? (local.pendingExpenseIds || []).filter((id) => {
        const localExpense = localExpensesById.get(id);
        const cloudExpense = cloudById.get(id);
        if (!cloudExpense) return true;
        if (!localExpense) return false;
        return !isSameExpense(localExpense, cloudExpense);
      })
    : [];

  // Conflict resolution for debt settlement transfers (Last-Write-Wins):
  // If a transfer has a pending offline mutation in the queue, keep the local settlement state.
  let settledTransferIds: string[];
  if (res.paymentStatuses) {
    const normalizedStatuses = res.paymentStatuses.map((status) => {
      const tid =
        status.transferId ||
        (status.fromUserId && status.toUserId
          ? `transfer_${status.fromUserId}_${status.toUserId}`
          : '');
      return { ...status, transferId: tid };
    });

    const cloudSettledSet = new Set(
      normalizedStatuses
        .filter((status) => status.isPaid && status.transferId)
        .map((status) => status.transferId)
    );
    const localSettledSet = new Set(local.settledTransferIds || []);

    const allTransferIds = new Set([
      ...normalizedStatuses.map((status) => status.transferId).filter(Boolean),
      ...localSettledSet,
    ]);

    const finalSettled = new Set<string>();
    for (const tid of allTransferIds) {
      if (isOperationPendingForTransfer(local.id, tid)) {
        if (localSettledSet.has(tid)) {
          finalSettled.add(tid);
        }
      } else {
        if (cloudSettledSet.has(tid)) {
          finalSettled.add(tid);
        }
      }
    }
    settledTransferIds = Array.from(finalSettled);
  } else {
    settledTransferIds = local.settledTransferIds || [];
  }

  // Merge shopping items with conflict resolution (preserve pending local writes).
  // `mapCloudShoppingList` also drops rows that belong to another room: a copy
  // or paste mistake in the sheet must not leak another party's purchases.
  const rawCloudShopping = res.shoppingList
    ? mapCloudShoppingList(res.shoppingList, local.id)
    : [];
  // Shopping items deleted on this device stay deleted even if the (possibly
  // stale) cloud snapshot still contains their rows. The caller retries the
  // deletion for anything that still exists server-side.
  const shoppingTombstoneIds = new Set(local.deletedShoppingItemIds || []);
  const rawCloudShoppingById = new Map(rawCloudShopping.map((item) => [item.id, item]));
  const cloudShopping = rawCloudShopping.filter((item) => !shoppingTombstoneIds.has(item.id));
  const cloudShoppingById = new Map(cloudShopping.map((item) => [item.id, item]));
  const localShoppingById = new Map((local.shoppingList || []).map((item) => [item.id, item]));

  const shoppingList = cloudShopping.map((cloudItem) => {
    const localItem = localShoppingById.get(cloudItem.id);
    const hasPendingMutation = isOperationPendingForShoppingItem(local.id, cloudItem.id);
    if (localItem && hasPendingMutation) {
      return localItem;
    }
    return cloudItem;
  });

  // Keep locally added items that are in the queue / pending upload or recently added
  const now = Date.now();
  for (const localItem of local.shoppingList || []) {
    if (!cloudShoppingById.has(localItem.id)) {
      const hasPendingMutation = isOperationPendingForShoppingItem(local.id, localItem.id);
      let isRecent = false;
      if (localItem.createdAt) {
        const itemAge = now - new Date(localItem.createdAt).getTime();
        if (!isNaN(itemAge) && itemAge < 90000) {
          isRecent = true;
        }
      }
      if (hasPendingMutation || isRecent) {
        shoppingList.unshift(localItem);
      }
    }
  }

  return {
    profiles,
    pendingUpload,
    pendingUpdates,
    party: {
      id: res.party.id,
      code: res.party.code,
      title: res.party.title,
      participants: profiles.length > 0 ? profiles : local.participants,
      expenses,
      // `undefined` means an older backend did not return shopping data, so
      // keep the local list. An empty array is authoritative and clears it
      // (except for pending/recent local additions handled above).
      shoppingList: res.shoppingList ? shoppingList : local.shoppingList || [],
      settledTransferIds,
      deletedExpenseIds: remainingTombstones,
      pendingExpenseIds: remainingPending,
      // A shopping tombstone is only needed while Google Sheets still contains
      // the row; confirmed deletions can be forgotten.
      deletedShoppingItemIds: options.keepLocalOnlyExpenses
        ? (local.deletedShoppingItemIds || []).filter((id) => rawCloudShoppingById.has(id))
        : [],
    },
  };
}
