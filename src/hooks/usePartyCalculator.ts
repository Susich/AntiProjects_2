import { useMemo } from 'react';
import { DebtCalculationResult, ExpenseItem, UserProfile } from '../types';
import { calculateBalances } from '../utils/debtSimplification';

interface UsePartyCalculatorParams {
  expenses: ExpenseItem[];
  participants: UserProfile[];
  settledTransferIds?: string[];
}

/**
 * Custom hook to calculate the precise split bill debt breakdown using
 * greedy debt simplification (Debt Minimization).
 */
export function usePartyCalculator({
  expenses,
  participants,
  settledTransferIds = [],
}: UsePartyCalculatorParams): DebtCalculationResult {
  return useMemo(() => {
    return calculateBalances(expenses, participants, settledTransferIds);
  }, [expenses, participants, settledTransferIds]);
}
