import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBalances } from '../src/utils/debtSimplification.ts';
import type { ExpenseItem, UserProfile } from '../src/types/index.ts';

test('DebtSync: calculateBalances computes net balances and minimal transfers correctly', () => {
  const alice: UserProfile = { id: 'user_alice', name: 'Alice', phone: '+79991112233', bank: 'Tinkoff' };
  const bob: UserProfile = { id: 'user_bob', name: 'Bob', phone: '+79992223344', bank: 'Sber' };
  const charlie: UserProfile = { id: 'user_charlie', name: 'Charlie', phone: '+79993334455', bank: 'Alfa' };

  // Expense: Alice paid 300 rubles for Alice, Bob, and Charlie equally (100 each)
  const expense1: ExpenseItem = {
    id: 'exp_1',
    title: 'Pizza',
    amount: 300,
    paidById: alice.id,
    splitBetween: [
      { userId: alice.id, share: 1 },
      { userId: bob.id, share: 1 },
      { userId: charlie.id, share: 1 },
    ],
  };

  const participants = [alice, bob, charlie];
  const initialResult = calculateBalances([expense1], participants, []);

  // Alice: paid 300, consumed 100 -> net +200 (Creditor)
  // Bob: paid 0, consumed 100 -> net -100 (Debtor)
  // Charlie: paid 0, consumed 100 -> net -100 (Debtor)
  assert.equal(initialResult.totalExpenses, 300);
  assert.equal(initialResult.creditors.length, 1);
  assert.equal(initialResult.debtors.length, 2);
  assert.equal(initialResult.transfers.length, 2);

  // Check transfers
  const bobTransfer = initialResult.transfers.find((t) => t.fromUser.id === bob.id);
  const charlieTransfer = initialResult.transfers.find((t) => t.fromUser.id === charlie.id);

  assert.ok(bobTransfer, 'Transfer from Bob should exist');
  assert.equal(bobTransfer.toUser.id, alice.id);
  assert.equal(bobTransfer.amount, 100);
  assert.equal(bobTransfer.isSettled, false);
  assert.equal(bobTransfer.id, `transfer_${bob.id}_${alice.id}`);

  assert.ok(charlieTransfer, 'Transfer from Charlie should exist');
  assert.equal(charlieTransfer.toUser.id, alice.id);
  assert.equal(charlieTransfer.amount, 100);
  assert.equal(charlieTransfer.isSettled, false);
  assert.equal(charlieTransfer.id, `transfer_${charlie.id}_${alice.id}`);

  assert.equal(initialResult.settledCount, 0);
  assert.equal(initialResult.pendingCount, 2);
  assert.equal(initialResult.totalPendingAmount, 200);
  assert.equal(initialResult.totalSettledAmount, 0);
});

test('DebtSync: handles settledTransferIds and updates status accordingly', () => {
  const alice: UserProfile = { id: 'user_alice', name: 'Alice', phone: '+79991112233', bank: 'Tinkoff' };
  const bob: UserProfile = { id: 'user_bob', name: 'Bob', phone: '+79992223344', bank: 'Sber' };
  const participants = [alice, bob];

  const expense: ExpenseItem = {
    id: 'exp_1',
    title: 'Groceries',
    amount: 500,
    paidById: alice.id,
    splitBetween: [
      { userId: alice.id, share: 1 },
      { userId: bob.id, share: 1 },
    ],
  };

  const transferId = `transfer_${bob.id}_${alice.id}`;

  // When transfer is settled
  const settledResult = calculateBalances([expense], participants, [transferId]);

  assert.equal(settledResult.transfers.length, 1);
  const transfer = settledResult.transfers[0];
  assert.equal(transfer.id, transferId);
  assert.equal(transfer.isSettled, true);
  assert.equal(settledResult.settledCount, 1);
  assert.equal(settledResult.pendingCount, 0);
  assert.equal(settledResult.totalSettledAmount, 250);
  assert.equal(settledResult.totalPendingAmount, 0);

  // Verify participant "isPaid" logic mapping matching ResultsScreen / ParticipantChips
  // For Debtor (Bob): all his outgoing transfers are settled -> isPaid = true
  const bobTransfers = settledResult.transfers.filter((t) => t.fromUser.id === bob.id);
  const isBobPaid = bobTransfers.length > 0 && bobTransfers.every((t) => t.isSettled);
  assert.equal(isBobPaid, true, 'Bob should have isPaid = true');

  // For Creditor (Alice): pendingCount === 0 -> all expected debts received -> isPaid = true
  const isAlicePaid = settledResult.pendingCount === 0;
  assert.equal(isAlicePaid, true, 'Alice should be considered settled when no pending transfers remain');
});

test('DebtSync: cent-exact distribution with odd splits prevents penny drift', () => {
  const u1: UserProfile = { id: 'u1', name: 'User 1', phone: '+7999111', bank: 'B1' };
  const u2: UserProfile = { id: 'u2', name: 'User 2', phone: '+7999222', bank: 'B2' };
  const u3: UserProfile = { id: 'u3', name: 'User 3', phone: '+7999333', bank: 'B3' };
  const participants = [u1, u2, u3];

  // 100 rubles split equally 3 ways = 33.33, 33.33, 33.34
  const expense: ExpenseItem = {
    id: 'exp_odd',
    title: 'Taxi',
    amount: 100,
    paidById: u1.id,
    splitBetween: [
      { userId: u1.id, share: 1 },
      { userId: u2.id, share: 1 },
      { userId: u3.id, share: 1 },
    ],
  };

  const result = calculateBalances([expense], participants, []);

  const totalTransfersAmount = result.transfers.reduce((sum, t) => sum + t.amount, 0);
  // User 1 paid 100, consumed 33.33. u2 owes 33.33, u3 owes 33.34 (last consumer gets remainder cent).
  // Total owed to u1 must be exactly 66.67 (100 - 33.33)
  assert.equal(Math.round(totalTransfersAmount * 100) / 100, 66.67);
  assert.equal(result.totalExpenses, 100);
});
