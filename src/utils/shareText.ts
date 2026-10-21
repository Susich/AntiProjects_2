import { Share, Platform } from 'react-native';
import { DebtCalculationResult, SimplifiedDebtTransfer } from '../types';
import { formatPhone, formatRubles } from './currency';

/**
 * Generates a shareable settlement summary. It intentionally contains only
 * bank/phone details and never builds payment URLs or deep links.
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

  const transferBlocks = result.transfers.map((t, index) => {
    const fromName = t.fromUser.name;
    const toName = t.toUser.name;
    const amountStr = formatRubles(t.amount);
    const phone = t.toUser.phone ? formatPhone(t.toUser.phone) : '';
    const bank = t.toUser.bank || 'банк не указан';
    const statusMark = t.isSettled ? '✅ [Оплачено]' : '⏳';

    let requisites = `      🏦 Банк: ${bank}`;
    requisites += phone
      ? `\n      📱 Телефон: ${phone}`
      : '\n      ⚠️ Телефон не указан — попросите получателя заполнить профиль';

    return `${index + 1}. ${statusMark} ${fromName} ➔ ${toName}: ${amountStr}\n${requisites}`;
  });

  return `📊 Взаимозачёт долгов: «${displayTitle}»
Общая сумма расходов: ${totalStr}
Количество переводов: ${result.transfers.length}

Кому и сколько переводить:
${transferBlocks.join('\n\n')}

Все расчёты сведены без лишних промежуточных переводов. После оплаты отметьте перевод в приложении! 🙌`;
}

/**
 * Generates a personalized message for a single debtor transfer.
 */
export function generateSingleTransferShareText(
  transfer: SimplifiedDebtTransfer,
  partyTitle: string
): string {
  const displayTitle = partyTitle.trim() || 'тусовку';
  const debtorName = transfer.fromUser.name;
  const creditorName = transfer.toUser.name;
  const amountStr = formatRubles(transfer.amount);
  const phone = transfer.toUser.phone ? formatPhone(transfer.toUser.phone) : '';
  const bank = transfer.toUser.bank || 'банк не указан';

  let requisites = `• Банк: ${bank}`;
  requisites += phone
    ? `\n• Телефон: ${phone}`
    : '\n• ⚠️ Телефон не указан — попросите получателя заполнить профиль';

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
