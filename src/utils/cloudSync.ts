import {
  CloudExpense,
  CloudMemberPayload,
  PartyApiResponse,
} from '../api/googleSheets';
import {
  ExpenseItem,
  ItemCategory,
  ParticipantProfile,
  PartyEvent,
} from '../types';

const VALID_CATEGORIES: ItemCategory[] = ['food', 'drink', 'hookah', 'delivery', 'other'];

/**
 * Converts a local profile into the payload expected by the Google Apps Script
 * `syncPartyMembers` action.
 */
export function toCloudMember(profile: ParticipantProfile): CloudMemberPayload {
  return {
    id: profile.id,
    name: profile.name,
    phone: profile.paymentInfo?.phone || '',
    paymentUrl: profile.paymentInfo?.sbpQrOrUrl || '',
  };
}

export function mapCloudProfiles(res: PartyApiResponse): ParticipantProfile[] {
  return (res.participants || []).map((p) => ({
    id: String(p.id),
    name: String(p.name || 'Участник'),
    avatarColor: p.avatarColor,
    paymentInfo: {
      phone: String(p.phone ?? ''),
      sbpQrOrUrl: p.paymentUrl,
    },
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

export function mergeUniqueIds(...groups: (string[] | undefined)[]): string[] {
  return Array.from(
    new Set(groups.flatMap((group) => (group || []).map((id) => String(id))).filter(Boolean))
  );
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
  profiles: ParticipantProfile[];
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
 * Converts a `getPartyDetails` / `syncPartyMembers` response into the local
 * party shape. The cloud room is the shared source of truth for members and
 * expenses: this is what makes edits and deletions visible on every device.
 *
 * With `keepLocalOnlyExpenses` (used by the background poll) locally created
 * expenses are preserved until the cloud confirms them, while deleted ids are
 * filtered through the tombstone list. Only ids listed in `pendingExpenseIds`
 * are re-uploaded; a row missing from the sheet may simply have been deleted
 * on another device.
 */
export function mergeCloudParty(
  local: PartyEvent,
  res: PartyApiResponse,
  options: { keepLocalOnlyExpenses?: boolean } = {}
): MergedCloudParty | null {
  if (!res.success || !res.party) return null;

  const profiles = mapCloudProfiles(res);
  const cloudParticipantIds = profiles.map((p) => p.id);
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
      // A pending edit must not be overwritten by an older cloud snapshot.
      if (
        localExpense &&
        pendingIds.has(expense.id) &&
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
      if (!pendingIds.has(expense.id) || tombstoneIds.has(expense.id)) continue;
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

  return {
    profiles,
    pendingUpload,
    pendingUpdates,
    party: {
      id: res.party.id,
      code: res.party.code,
      title: res.party.title,
      participants:
        cloudParticipantIds.length > 0 ? cloudParticipantIds : local.participants,
      expenses,
      deletedExpenseIds: remainingTombstones,
      pendingExpenseIds: remainingPending,
    },
  };
}
