import { Share, Platform } from 'react-native';
import { DebtCalculationResult, SimplifiedDebtTransfer } from '../types';
import { formatPhone, formatRubles } from './currency';

/**
 * Generates structured, clear, and visually appealing summary text
 * containing all simplified debt transfers and creditors' SBP requisites
 * for sharing to Telegram/WhatsApp group chats.
 */
export function generatePartySettlementSummary(
  result: DebtCalculationResult,
  partyTitle: string
): string {
  const displayTitle = partyTitle.trim() || 'Вечеринка';
  const totalStr = formatRubles(result.totalExpenses);

  if (result.transfers.length === 0) {
    return `🎉 «${displayTitle}» — Все в расчёте!
Общий чек: ${totalStr}.
Никто никому ничего не должен! ✨`;
  }

  // Format transfers list with requisites
  const transferBlocks = result.transfers.map((t, index) => {
    const fromName = t.fromUser.name;
    const toName = t.toUser.name;
    const amountStr = formatRubles(t.amount);
    const phone = t.toUser.paymentInfo.phone ? formatPhone(t.toUser.paymentInfo.phone) : '';
    const url = t.toUser.paymentInfo.sbpQrOrUrl ? t.toUser.paymentInfo.sbpQrOrUrl.trim() : '';
    const statusMark = t.isSettled ? '✅ [Оплачено]' : '⏳';

    let requisites = '      💳 Перевод по СБП';
    if (phone) {
      requisites += `\n      📱 Телефон: ${phone}`;
    }
    if (url) {
      requisites += `\n      🔗 СБП-ссылка: ${url}`;
    }
    if (!phone && !url) {
      requisites += '\n      ⚠️ Реквизиты не указаны — попросите получателя добавить телефон в профиле';
    }

    return `${index + 1}. ${statusMark} ${fromName} ➔ ${toName}: ${amountStr}\n${requisites}`;
  });

  return `📊 Взаимозачёт долгов: «${displayTitle}»
Общая сумма расходов: ${totalStr}
Количество переводов: ${result.transfers.length}

Кому и сколько переводить (СБП):
${transferBlocks.join('\n\n')}

Все расчёты сведены без лишних промежуточных переводов. После оплаты пришлите чек / подтверждение! 🙌`;
}

/**
 * Generates personalized message for a single debtor transfer.
 */
export function generateSingleTransferShareText(
  transfer: SimplifiedDebtTransfer,
  partyTitle: string
): string {
  const displayTitle = partyTitle.trim() || 'тусовку';
  const debtorName = transfer.fromUser.name;
  const creditorName = transfer.toUser.name;
  const amountStr = formatRubles(transfer.amount);
  const phone = transfer.toUser.paymentInfo.phone
    ? formatPhone(transfer.toUser.paymentInfo.phone)
    : '';
  const url = transfer.toUser.paymentInfo.sbpQrOrUrl
    ? transfer.toUser.paymentInfo.sbpQrOrUrl.trim()
    : '';

  let requisites = '• Перевод по СБП';
  if (phone) {
    requisites += `\n• Телефон: ${phone}`;
  }
  if (url) {
    requisites += `\n• СБП-ссылка: ${url}`;
  }
  if (!phone && !url) {
    requisites += '\n• ⚠️ Реквизиты не указаны — попросите получателя добавить телефон';
  }

  return `Привет, ${debtorName}! 👋
По итогам сведения чека за «${displayTitle}» твой финальный перевод: ${amountStr} в пользу ${creditorName}.

Реквизиты получателя (${creditorName}):
${requisites}

Спасибо за вечер! 🎉`;
}

/**
 * Triggers system share dialog for full settlement summary.
 */
export async function sharePartySettlement(
  result: DebtCalculationResult,
  partyTitle: string
): Promise<boolean> {
  const message = generatePartySettlementSummary(result, partyTitle);
  try {
    const shareResult = await Share.share(
      Platform.select({
        ios: { message },
        default: { message, title: `Итоги «${partyTitle}»` },
      })
    );
    return shareResult.action === Share.sharedAction;
  } catch (error) {
    console.warn('[Share] Error sharing settlement summary:', error);
    return false;
  }
}

/**
 * Triggers system share dialog for a single transfer.
 */
export async function shareSingleTransfer(
  transfer: SimplifiedDebtTransfer,
  partyTitle: string
): Promise<boolean> {
  const message = generateSingleTransferShareText(transfer, partyTitle);
  try {
    const shareResult = await Share.share(
      Platform.select({
        ios: { message },
        default: { message, title: `Перевод за «${partyTitle}»` },
      })
    );
    return shareResult.action === Share.sharedAction;
  } catch (error) {
    console.warn('[Share] Error sharing transfer:', error);
    return false;
  }
}
