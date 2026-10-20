import {
  DebtCalculationResult,
  ExpenseItem,
  ParticipantBalance,
  ParticipantProfile,
  SimplifiedDebtTransfer,
} from '../types';

/**
 * Calculates net balances and generates the minimum list of debt transfers (Debt Simplification).
 *
 * 1. For each participant, computes:
 *    Net Balance = (Total paid from own pocket) - (Total consumed)
 * 2. Distributes cents cleanly to avoid any penny/cent rounding drift.
 * 3. Divides into Creditors (Net > 0) and Debtors (Net < 0).
 * 4. Executes a greedy matching algorithm (Debt Minimization) to produce
 *    the optimal minimal list of transfers: { fromUser, toUser, amount }.
 */
export function calculateBalances(
  expenses: ExpenseItem[],
  participants: ParticipantProfile[],
  settledTransferIds: string[] = []
): DebtCalculationResult {
  if (participants.length === 0) {
    let unassignedCost = 0;
    expenses.forEach((e) => {
      unassignedCost += Math.max(0, Number(e.amount) || 0);
    });

    return {
      totalExpenses: unassignedCost,
      balances: [],
      creditors: [],
      debtors: [],
      transfers: [],
      settledCount: 0,
      pendingCount: 0,
      totalSettledAmount: 0,
      totalPendingAmount: 0,
      unassignedExpensesCount: expenses.length,
      unassignedCost,
    };
  }

  // Map participant ID to their tracking record (tracked in integer cents for absolute precision)
  interface InternalBalance {
    participant: ParticipantProfile;
    paidCents: number;
    consumedCents: number;
    itemsPaid: ExpenseItem[];
    itemsConsumed: { expense: ExpenseItem; shareCost: number }[];
  }

  const balanceMap = new Map<string, InternalBalance>();

  participants.forEach((p) => {
    balanceMap.set(p.id, {
      participant: p,
      paidCents: 0,
      consumedCents: 0,
      itemsPaid: [],
      itemsConsumed: [],
    });
  });

  let totalExpensesCents = 0;
  let unassignedExpensesCount = 0;
  let unassignedCostCents = 0;

  // Process all expenses
  expenses.forEach((expense) => {
    const amountNum = Math.max(0, Number(expense.amount) || 0);
    const amountCents = Math.round(amountNum * 100);

    if (amountCents <= 0) return;

    totalExpensesCents += amountCents;

    // Credit payer
    const payerRecord = balanceMap.get(expense.paidById);
    if (payerRecord) {
      payerRecord.paidCents += amountCents;
      payerRecord.itemsPaid.push(expense);
    } else {
      // If payer is not in active party, count as unassigned
      unassignedCostCents += amountCents;
    }

    // Debit consumers
    const validConsumers = (expense.splitBetween || []).filter((s) => balanceMap.has(s.userId));

    if (validConsumers.length === 0) {
      unassignedExpensesCount += 1;
      return;
    }

    // Check if custom weights or shares are provided
    const hasCustomShares = validConsumers.some(
      (s) => typeof s.share === 'number' && s.share > 0
    );

    if (hasCustomShares) {
      const totalWeight = validConsumers.reduce(
        (sum, c) => sum + (typeof c.share === 'number' && c.share > 0 ? c.share : 1),
        0
      );

      let allocatedCents = 0;
      validConsumers.forEach((consumer, idx) => {
        const weight = typeof consumer.share === 'number' && consumer.share > 0 ? consumer.share : 1;
        // Allocate proportionally; last consumer gets remaining cents to guarantee 100% exact match
        const shareCents =
          idx === validConsumers.length - 1
            ? amountCents - allocatedCents
            : Math.floor((weight / totalWeight) * amountCents);

        allocatedCents += shareCents;
        const record = balanceMap.get(consumer.userId);
        if (record) {
          record.consumedCents += shareCents;
          record.itemsConsumed.push({
            expense,
            shareCost: shareCents / 100,
          });
        }
      });
    } else {
      // Equal split with exact integer penny distribution
      const splitCount = validConsumers.length;
      const baseShareCents = Math.floor(amountCents / splitCount);
      const remainder = amountCents - baseShareCents * splitCount;

      validConsumers.forEach((consumer, idx) => {
        const shareCents = baseShareCents + (idx < remainder ? 1 : 0);
        const record = balanceMap.get(consumer.userId);
        if (record) {
          record.consumedCents += shareCents;
          record.itemsConsumed.push({
            expense,
            shareCost: shareCents / 100,
          });
        }
      });
    }
  });

  // Calculate net balances in standard rubles
  const balances: ParticipantBalance[] = [];
  const creditors: ParticipantBalance[] = [];
  const debtors: ParticipantBalance[] = [];

  balanceMap.forEach((rec) => {
    const totalPaid = rec.paidCents / 100;
    const totalConsumed = rec.consumedCents / 100;
    const netBalanceCents = rec.paidCents - rec.consumedCents;
    const netBalance = netBalanceCents / 100;

    const balanceItem: ParticipantBalance = {
      participant: rec.participant,
      totalPaid,
      totalConsumed,
      netBalance,
      itemsPaid: rec.itemsPaid,
      itemsConsumed: rec.itemsConsumed,
    };

    balances.push(balanceItem);

    if (netBalanceCents > 0) {
      creditors.push(balanceItem);
    } else if (netBalanceCents < 0) {
      debtors.push(balanceItem);
    }
  });

  // Sort creditors descending by net balance
  creditors.sort((a, b) => b.netBalance - a.netBalance);
  // Sort debtors ascending by net balance (largest negative first, i.e. highest debt)
  debtors.sort((a, b) => a.netBalance - b.netBalance);

  // Greedy Debt Simplification Algorithm
  // Working arrays of cents to prevent any floating point precision flaws
  const workingCreditors = creditors.map((c) => ({
    participant: c.participant,
    cents: Math.round(c.netBalance * 100),
  }));

  const workingDebtors = debtors.map((d) => ({
    participant: d.participant,
    cents: Math.round(Math.abs(d.netBalance) * 100),
  }));

  const transfers: SimplifiedDebtTransfer[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < workingCreditors.length && dIdx < workingDebtors.length) {
    const cred = workingCreditors[cIdx];
    const deb = workingDebtors[dIdx];

    const settleCents = Math.min(cred.cents, deb.cents);

    if (settleCents > 0) {
      const amount = settleCents / 100;
      const transferId = `transfer_${deb.participant.id}_${cred.participant.id}`;
      const isSettled = settledTransferIds.includes(transferId);

      transfers.push({
        id: transferId,
        fromUser: deb.participant,
        toUser: cred.participant,
        amount,
        isSettled,
      });

      cred.cents -= settleCents;
      deb.cents -= settleCents;
    }

    if (cred.cents <= 0) cIdx += 1;
    if (deb.cents <= 0) dIdx += 1;
  }

  // Compute settled & pending totals
  let settledCount = 0;
  let pendingCount = 0;
  let totalSettledAmount = 0;
  let totalPendingAmount = 0;

  transfers.forEach((t) => {
    if (t.isSettled) {
      settledCount += 1;
      totalSettledAmount += t.amount;
    } else {
      pendingCount += 1;
      totalPendingAmount += t.amount;
    }
  });

  return {
    totalExpenses: totalExpensesCents / 100,
    balances,
    creditors,
    debtors,
    transfers,
    settledCount,
    pendingCount,
    totalSettledAmount: Math.round(totalSettledAmount * 100) / 100,
    totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
    unassignedExpensesCount,
    unassignedCost: unassignedCostCents / 100,
  };
}
