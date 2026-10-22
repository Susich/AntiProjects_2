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
  return (expenses || []).map((e) => {
    const category = String(e.category || '') as ItemCategory;
    return {
      id: String(e.id),
      title: String(e.title || 'Расход'),
      amount: Number(e.amount) || 0,
      paidById: String(e.paidById ?? ''),
      splitBetween: (e.sharedUserIds || []).map((uid) => ({ userId: String(uid) })),
      category: VALID_CATEGORIES.includes(category) ? category : undefined,
      date: e.createdAt,
    };
  });
}

export function mapCloudShoppingList(items?: CloudShoppingItem[]): ShoppingItem[] {
  return (items || []).map((item) => {
    const category = String(item.category || '') as ItemCategory;
    return {
      id: String(item.id),
      title: String(item.title || 'Покупка'),
      estimatedAmount: Number(item.estimatedAmount) || undefined,
      assignedUserId: item.assignedUserId ? String(item.assignedUserId) : undefined,
      isBought: Boolean(item.isBought),
      boughtById: item.boughtById ? String(item.boughtById) : undefined,
      actualAmount: Number(item.actualAmount) || undefined,
      convertedExpenseId: item.convertedExpenseId ? String(item.convertedExpenseId) : undefined,
      category: VALID_CATEGORIES.includes(category) ? category : undefined,
      createdAt: item.createdAt ? String(item.createdAt) : undefined,
    };
  });
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

  // Merge shopping items with conflict resolution (preserve pending local writes)
  const rawCloudShopping = res.shoppingList ? mapCloudShoppingList(res.shoppingList) : [];
  const cloudShoppingById = new Map(rawCloudShopping.map((item) => [item.id, item]));
  const localShoppingById = new Map((local.shoppingList || []).map((item) => [item.id, item]));

  const shoppingList = rawCloudShopping.map((cloudItem) => {
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
      shoppingList: shoppingList.length > 0 || res.shoppingList ? shoppingList : local.shoppingList || [],
      settledTransferIds,
      deletedExpenseIds: remainingTombstones,
      pendingExpenseIds: remainingPending,
    },
  };
}
