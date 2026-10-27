/**
 * Core domain types for PartySplit / Split Bill application.
 *
 * A participant is an authenticated app user: their profile is the single
 * source of truth for their name, phone and bank. There is no separate
 * address-book of profiles or payment links.
 */

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  bank: string;
  avatarColor?: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
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

export interface TransferStatus {
  transferId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  isPaid: boolean;
  updatedAt?: string;
}

export interface ShoppingItem {
  id: string;
  title: string;
  estimatedAmount?: number; // Примерная цена (руб)
  actualAmount?: number; // Фактическая сумма покупки
  assignedUserId?: string; // Кто вызвался купить (ID участника)
  isBought: boolean; // Статус покупки
  boughtById?: string; // Кто фактически купил и оплатил (ID участника)
  convertedExpenseId?: string; // ID созданной записи расхода в чеке
  category?: ItemCategory;
  createdAt?: string;
}

export interface PartyEvent {
  id: string;
  code?: string; // 6-значный буквенно-цифровой код комнаты (например, "PUB777")
  title: string;
  date: string;
  createdBy?: string;
  participants: UserProfile[]; // authenticated users currently in the room
  expenses: ExpenseItem[];
  shoppingList?: ShoppingItem[]; // Список запланированных покупок для тусовки
  settledTransferIds?: string[];
  // Expenses deleted on this device. Kept until Google Sheets confirms the
  // deletion, so a background refresh cannot resurrect a removed cheque.
  deletedExpenseIds?: string[];
  // Expenses created on this device that Google Sheets has not confirmed yet.
  // They are re-uploaded on refresh, but never re-uploaded just because they
  // disappeared from the sheet (that would undo another device's deletion).
  pendingExpenseIds?: string[];
  // Shopping items deleted on this device. Kept until Google Sheets confirms
  // the deletion, so a background refresh cannot resurrect a removed item.
  deletedShoppingItemIds?: string[];
}

export interface SimplifiedDebtTransfer {
  id: string;
  fromUser: UserProfile;
  toUser: UserProfile;
  amount: number;
  isSettled?: boolean;
}

export interface ParticipantBalance {
  participant: UserProfile;
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
export type BillItem = ExpenseItem;
export type PartySession = PartyEvent;

// Notification System Types
export type NotificationType =
  | 'party_invite'
  | 'bill_change'
  | 'payment_status'
  | 'debt_reminder'
  | 'party_closed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  partyId?: string;
  partyTitle?: string;
  amount?: number;
  actorName?: string;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  enabled: boolean;
  channels: {
    system: boolean;
    inApp: boolean;
  };
  categories: {
    party_invite: boolean;
    bill_change: boolean;
    payment_status: boolean;
    debt_reminder: boolean;
    party_closed: boolean;
  };
}
