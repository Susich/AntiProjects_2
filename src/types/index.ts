/**
 * Core domain types for PartySplit / Split Bill application.
 * Payments are SBP-only: a participant shares a phone number and, optionally,
 * a personal SBP link/QR that opens the payer's bank in one tap.
 */

export interface ParticipantPaymentInfo {
  phone: string; // Номер телефона для СБП (например, "79991234567")
  sbpQrOrUrl?: string; // Персональная СБП-ссылка или QR получателя
}

export interface ParticipantProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor?: string;
  paymentInfo: ParticipantPaymentInfo;
}

export type ItemCategory = 'food' | 'drink' | 'hookah' | 'delivery' | 'other';

export interface ExpenseSplit {
  userId: string;
  share?: number; // optionally explicit share amount or weight, default equal
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidById: string; // Кто заплатил из своего кармана (ID участника)
  splitBetween: ExpenseSplit[]; // Кто участвовал в потреблении (поровну или в долях)
  category?: ItemCategory;
  date?: string;
}

export type Expense = ExpenseItem;

export interface PartyEvent {
  id: string;
  code?: string; // 6-значный буквенно-цифровой код комнаты (например, "PUB777")
  title: string;
  date: string;
  createdBy?: string;
  participants: string[]; // string[] IDs профилей участников
  expenses: ExpenseItem[];
  settledTransferIds?: string[];
  // Expenses deleted on this device. Kept until Google Sheets confirms the
  // deletion, so a background refresh cannot resurrect a removed cheque.
  deletedExpenseIds?: string[];
  // Expenses created on this device that Google Sheets has not confirmed yet.
  // They are re-uploaded on refresh, but never re-uploaded just because they
  // disappeared from the sheet (that would undo another device's deletion).
  pendingExpenseIds?: string[];
}

export interface SimplifiedDebtTransfer {
  id: string;
  fromUser: ParticipantProfile;
  toUser: ParticipantProfile;
  amount: number;
  isSettled?: boolean;
}

export interface ParticipantBalance {
  participant: ParticipantProfile;
  totalPaid: number;
  totalConsumed: number;
  netBalance: number; // >0: creditor, <0: debtor, 0: settled
  itemsPaid: ExpenseItem[];
  itemsConsumed: { expense: ExpenseItem; shareCost: number }[];
}

export interface DebtCalculationResult {
  totalExpenses: number;
  balances: ParticipantBalance[];
  creditors: ParticipantBalance[];
  debtors: ParticipantBalance[];
  transfers: SimplifiedDebtTransfer[];
  settledCount: number;
  pendingCount: number;
  totalSettledAmount: number;
  totalPendingAmount: number;
  unassignedExpensesCount: number;
  unassignedCost: number;
}

// Backwards compatibility aliases for smooth transition
export type Friend = ParticipantProfile;
export type BillItem = ExpenseItem;
export type PartySession = PartyEvent;
