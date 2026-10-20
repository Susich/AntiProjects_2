import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ParticipantProfile } from '../types';
import { cleanPhone, formatPhone, formatRubles } from './currency';

export interface SbpPaymentResult {
  success: boolean;
  type: 'sbp-link' | 'manual';
  message: string;
  copiedPhone?: string;
  amountText?: string;
}

/**
 * Copies arbitrary text to the system clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.warn('[Clipboard] Failed to copy text:', error);
    return false;
  }
}

async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

function openUrl(rawUrl: string): Promise<boolean> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return Promise.resolve(false);
  const formatted = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return tryOpenUrl(formatted);
}

/**
 * SBP-only payment flow.
 *
 * There is no public cross-bank deep link that prefills a phone transfer, so
 * the reliable "smart" route is the recipient's personal SBP link/QR. It opens
 * the payer's banking app (or the OS bank chooser) with the transfer form ready.
 *
 * When the recipient has only a phone number, it is copied to the clipboard and
 * the caller shows short instructions: open your bank → SBP transfer → paste the
 * number. No bank selection or bank-specific deep links are involved.
 */
export async function payToCreditor(
  creditor: ParticipantProfile,
  amount: number
): Promise<SbpPaymentResult> {
  const payment = creditor.paymentInfo;
  const amountStr = formatRubles(amount);
  const phone = cleanPhone(payment.phone);
  const formattedPhone = formatPhone(phone);
  const sbpUrl = (payment.sbpQrOrUrl || '').trim();

  // A paste-friendly phone number with country code is useful in every branch.
  if (phone) {
    await copyToClipboard(phone);
  }

  if (sbpUrl) {
    if (await openUrl(sbpUrl)) {
      return {
        success: true,
        type: 'sbp-link',
        message: `Открыта СБП-ссылка получателя ${creditor.name}. Проверьте сумму ${amountStr} и подтвердите перевод.`,
        copiedPhone: formattedPhone || undefined,
        amountText: amountStr,
      };
    }
  }

  if (phone) {
    const reason = sbpUrl
      ? 'СБП-ссылку открыть не удалось, но номер получателя уже скопирован.'
      : 'У получателя не указана СБП-ссылка, но номер уже скопирован.';
    return {
      success: false,
      type: 'manual',
      message: `${reason} Откройте свой банк → «Перевод по СБП» → вставьте ${formattedPhone} и укажите сумму ${amountStr}.`,
      copiedPhone: formattedPhone,
      amountText: amountStr,
    };
  }

  return {
    success: false,
    type: 'manual',
    message: sbpUrl
      ? `Не удалось открыть СБП-ссылку получателя ${creditor.name}, а телефон для СБП у него не указан. Попросите добавить номер в профиле.`
      : `У получателя ${creditor.name} не указан ни телефон, ни СБП-ссылка. Попросите его заполнить профиль.`,
    amountText: amountStr,
  };
}
