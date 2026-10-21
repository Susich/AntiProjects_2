import { ExpenseItem, PartyEvent, UserProfile } from '../types';

export interface PaidBillStat {
  expense: ExpenseItem;
  partyId: string;
  partyTitle: string;
  date: string;
}

export interface UserStats {
  totalSpent: number;
  totalFronted: number;
  billsPaidCount: number;
  paidBills: PaidBillStat[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function userShareInExpense(expense: ExpenseItem, userId: string): number {
  const split = (expense.splitBetween || []).filter(
    (entry) => entry.userId && expense.amount > 0
  );
  if (split.length === 0) return 0;

  const ownEntry = split.find((entry) => entry.userId === userId);
  if (!ownEntry) return 0;

  const hasCustomWeights = split.some(
    (entry) => typeof entry.share === 'number' && entry.share > 0
  );
  if (!hasCustomWeights) {
    return expense.amount / split.length;
  }

  const totalWeight = split.reduce(
    (sum, entry) =>
      sum + (typeof entry.share === 'number' && entry.share > 0 ? entry.share : 1),
    0
  );
  const ownWeight =
    typeof ownEntry.share === 'number' && ownEntry.share > 0 ? ownEntry.share : 1;
  return (expense.amount * ownWeight) / totalWeight;
}

/**
 * Builds "all time" personal statistics from the active room and archived
 * parties. Only authenticated user ids are counted, so old demo data and
 * deleted participants cannot inflate the numbers.
 */
export function getUserStats(
  user: UserProfile | null,
  currentParty: PartyEvent,
  history: PartyEvent[]
): UserStats {
  if (!user) {
    return {
      totalSpent: 0,
      totalFronted: 0,
      billsPaidCount: 0,
      paidBills: [],
    };
  }

  const partiesById = new Map<string, PartyEvent>();
  const orderedParties = [currentParty, ...(history || [])];
  orderedParties.forEach((party) => {
    if (!party || !party.id) return;
    if (!partiesById.has(party.id)) {
      partiesById.set(party.id, party);
    }
  });

  let totalSpent = 0;
  let totalFronted = 0;
  const paidBills: PaidBillStat[] = [];

  partiesById.forEach((party) => {
    (party.expenses || []).forEach((expense) => {
      if ((expense.splitBetween || []).some((split) => split.userId === user.id)) {
        totalSpent += userShareInExpense(expense, user.id);
      }

      if (expense.paidById === user.id) {
        totalFronted += Number(expense.amount) || 0;
        paidBills.push({
          expense,
          partyId: party.id,
          partyTitle: party.title || 'Тусовка',
          date: expense.date || party.date,
        });
      }
    });
  });

  paidBills.sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });

  return {
    totalSpent: roundMoney(totalSpent),
    totalFronted: roundMoney(totalFronted),
    billsPaidCount: paidBills.length,
    paidBills,
  };
}
