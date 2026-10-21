/**
 * Bank names are labels only. The app never builds bank-specific links or
 * deep links: the payer copies the recipient's phone and uses their own bank.
 */
export const BANKS = [
  'Сбербанк',
  'Т-Банк',
  'Альфа-Банк',
  'ВТБ',
  'Райффайзен',
  'Газпромбанк',
  'Совкомбанк',
  'Ozon Банк',
  'Яндекс Банк',
  'Другой банк',
] as const;

export type BankName = (typeof BANKS)[number];

export const DEFAULT_BANK: BankName = 'Сбербанк';

export function normalizeBank(value: unknown): string {
  const bank = typeof value === 'string' ? value.trim() : '';
  return bank || DEFAULT_BANK;
}
