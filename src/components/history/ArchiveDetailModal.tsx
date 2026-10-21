import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ExpenseItem, PartyEvent, SimplifiedDebtTransfer, UserProfile } from '../../types';
import {
  cleanPhone,
  formatPhone,
  formatRubles,
  getAvatarColor,
  getInitials,
} from '../../utils/currency';
import { calculateBalances } from '../../utils/debtSimplification';
import { copyToClipboard } from '../../utils/clipboard';
import { sharePartySettlement } from '../../utils/shareText';
import { useToast } from '../common/Toast';

interface ArchiveDetailModalProps {
  visible: boolean;
  onClose: () => void;
  party: PartyEvent | null;
}

type TabType = 'summary' | 'items' | 'members';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'pizza-outline',
  drink: 'beer-outline',
  hookah: 'cloudy-outline',
  delivery: 'car-outline',
  other: 'receipt-outline',
};

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Еда',
  drink: 'Напитки',
  hookah: 'Кальян',
  delivery: 'Доставка',
  other: 'Прочее',
};

export const ArchiveDetailModal: React.FC<ArchiveDetailModalProps> = ({
  visible,
  onClose,
  party,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  const calculation = useMemo(() => {
    if (!party) return null;
    return calculateBalances(
      party.expenses || [],
      party.participants || [],
      party.settledTransferIds || []
    );
  }, [party]);

  if (!party || !calculation) {
    return null;
  }

  const parsedDate = Date.parse(party.date);
  const formattedDate = Number.isFinite(parsedDate)
    ? new Date(parsedDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : party.date || 'Дата не указана';

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      showToast(`${label} скопирован`, { type: 'success' });
    }
  };

  const handleShare = async () => {
    if (!calculation || !party) return;
    await sharePartySettlement(calculation, party.title);
  };

  const getParticipant = (id: string): UserProfile | undefined =>
    party.participants.find((p) => p.id === id);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height={Platform.OS === 'web' ? '92%' : '90%'}
      maxHeight="94%"
      sheetStyle={{ backgroundColor: theme.colors.background }}
    >
      {({ onScroll }) => (
        <View style={styles.modalBody}>
          {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.badgeRow}>
              <View style={styles.readOnlyBadge}>
                <Ionicons name="lock-closed" size={11} color={theme.colors.info} />
                <Text style={styles.readOnlyText}>Архив • Только чтение</Text>
              </View>
              {party.code ? (
                <View style={styles.roomCodeBadge}>
                  <Ionicons name="key-outline" size={11} color={theme.colors.primary} />
                  <Text style={styles.roomCodeText}>{party.code}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.partyTitle} numberOfLines={1}>
              {party.title}
            </Text>
            <Text style={styles.partyDate}>{formattedDate}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionCircleBtn}
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Поделиться отчётом"
            >
              <Ionicons name="share-social-outline" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCircleBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Ionicons name="close" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Highlights Summary Card */}
        <View style={styles.quickOverviewCard}>
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>Общий счёт</Text>
            <Text style={styles.overviewAmount}>{formatRubles(calculation.totalExpenses)}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>Позиций</Text>
            <Text style={styles.overviewValue}>{party.expenses.length}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>Участников</Text>
            <Text style={styles.overviewValue}>{party.participants.length}</Text>
          </View>
        </View>

        {/* Segmented Tab Controls */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'summary' && styles.tabButtonActive]}
            onPress={() => setActiveTab('summary')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="pie-chart-outline"
              size={15}
              color={activeTab === 'summary' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'summary' && styles.tabButtonTextActive,
              ]}
            >
              Счета и итоги
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'items' && styles.tabButtonActive]}
            onPress={() => setActiveTab('items')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={activeTab === 'items' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'items' && styles.tabButtonTextActive,
              ]}
            >
              Товары ({party.expenses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
            onPress={() => setActiveTab('members')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={15}
              color={activeTab === 'members' ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'members' && styles.tabButtonTextActive,
              ]}
            >
              Участники ({party.participants.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content Body */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {activeTab === 'summary' && (
            <SummaryTabContent
              calculation={calculation}
              theme={theme}
              styles={styles}
              onCopy={handleCopy}
            />
          )}

          {activeTab === 'items' && (
            <ItemsTabContent
              expenses={party.expenses}
              getParticipant={getParticipant}
              theme={theme}
              styles={styles}
            />
          )}

          {activeTab === 'members' && (
            <MembersTabContent
              calculation={calculation}
              theme={theme}
              styles={styles}
              onCopy={handleCopy}
            />
          )}
        </ScrollView>
      </View>
    )}
  </BottomSheetModal>
  );
};

/* ========================================================================= */
/* TAB 1: SUMMARY & DEBT TRANSFERS                                           */
/* ========================================================================= */
interface SummaryTabContentProps {
  calculation: ReturnType<typeof calculateBalances>;
  theme: ThemeTokens;
  styles: ReturnType<typeof createStyles>;
  onCopy: (text: string, label: string) => void;
}

const SummaryTabContent: React.FC<SummaryTabContentProps> = ({
  calculation,
  theme,
  styles,
  onCopy,
}) => {
  const isFullySettled =
    calculation.transfers.length > 0 &&
    calculation.transfers.every((t) => t.isSettled);

  return (
    <View style={styles.tabContentWrap}>
      {/* Settlement Status Banner */}
      <View
        style={[
          styles.settlementStatusCard,
          isFullySettled ? styles.settlementCardDone : styles.settlementCardPending,
        ]}
      >
        <Ionicons
          name={isFullySettled ? 'checkmark-circle' : 'time-outline'}
          size={22}
          color={isFullySettled ? theme.colors.success : theme.colors.warning}
        />
        <View style={styles.settlementTextWrap}>
          <Text style={styles.settlementTitle}>
            {isFullySettled
              ? 'Все расчёты завершены'
              : calculation.transfers.length === 0
              ? 'Все были в расчёте'
              : `${calculation.settledCount} из ${calculation.transfers.length} переводов закрыто`}
          </Text>
          <Text style={styles.settlementSub}>
            Оплачено: {formatRubles(calculation.totalSettledAmount)} · Ожидало:{' '}
            {formatRubles(calculation.totalPendingAmount)}
          </Text>
        </View>
      </View>

      {/* Transfers Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Финальный расчёт переводов</Text>
        <Text style={styles.sectionCounter}>{calculation.transfers.length}</Text>
      </View>

      {calculation.transfers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="sparkles-outline" size={32} color={theme.colors.success} />
          <Text style={styles.emptyCardTitle}>Никто никому ничего не должен</Text>
          <Text style={styles.emptyCardSub}>
            Каждый участник потратил ровно столько, сколько потребил, или в тусовке не было позиций.
          </Text>
        </View>
      ) : (
        calculation.transfers.map((transfer: SimplifiedDebtTransfer, index: number) => {
          const isSettled = Boolean(transfer.isSettled);
          const phone = cleanPhone(transfer.toUser.phone);

          return (
            <View
              key={transfer.id || `transfer-${index}`}
              style={[styles.transferCard, isSettled && styles.transferCardSettled]}
            >
              <View style={styles.transferTopRow}>
                {/* Users from -> to */}
                <View style={styles.transferParticipants}>
                  <View
                    style={[
                      styles.avatarSmall,
                      {
                        backgroundColor:
                          transfer.fromUser.avatarColor ||
                          getAvatarColor(transfer.fromUser.name),
                      },
                    ]}
                  >
                    <Text style={styles.avatarSmallText}>
                      {getInitials(transfer.fromUser.name)}
                    </Text>
                  </View>
                  <Text style={styles.transferUserName} numberOfLines={1}>
                    {transfer.fromUser.name}
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={theme.colors.textMuted}
                    style={{ marginHorizontal: 4 }}
                  />

                  <View
                    style={[
                      styles.avatarSmall,
                      {
                        backgroundColor:
                          transfer.toUser.avatarColor ||
                          getAvatarColor(transfer.toUser.name),
                      },
                    ]}
                  >
                    <Text style={styles.avatarSmallText}>
                      {getInitials(transfer.toUser.name)}
                    </Text>
                  </View>
                  <Text style={styles.transferUserName} numberOfLines={1}>
                    {transfer.toUser.name}
                  </Text>
                </View>

                {/* Amount */}
                <Text style={styles.transferAmount}>{formatRubles(transfer.amount)}</Text>
              </View>

              {/* Status & Requisites row */}
              <View style={styles.transferBottomRow}>
                <View
                  style={[
                    styles.statusBadge,
                    isSettled ? styles.statusBadgeSettled : styles.statusBadgePending,
                  ]}
                >
                  <Ionicons
                    name={isSettled ? 'checkmark-circle' : 'hourglass-outline'}
                    size={12}
                    color={isSettled ? theme.colors.success : theme.colors.warning}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: isSettled ? theme.colors.success : theme.colors.warning },
                    ]}
                  >
                    {isSettled ? 'Оплачено' : 'Ожидает'}
                  </Text>
                </View>

                {transfer.toUser.bank ? (
                  <View style={styles.requisitePill}>
                    <Ionicons name="card-outline" size={11} color={theme.colors.textMuted} />
                    <Text style={styles.requisiteText} numberOfLines={1}>
                      {transfer.toUser.bank}
                    </Text>
                  </View>
                ) : null}

                {phone ? (
                  <TouchableOpacity
                    style={styles.requisiteCopyBtn}
                    onPress={() => onCopy(`+${phone}`, 'Номер телефона')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={11} color={theme.colors.info} />
                    <Text style={styles.requisiteCopyText}>
                      {formatPhone(transfer.toUser.phone)}
                    </Text>
                    <Ionicons name="copy-outline" size={10} color={theme.colors.info} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};

/* ========================================================================= */
/* TAB 2: ITEMS / EXPENSES LIST                                              */
/* ========================================================================= */
interface ItemsTabContentProps {
  expenses: ExpenseItem[];
  getParticipant: (id: string) => UserProfile | undefined;
  theme: ThemeTokens;
  styles: ReturnType<typeof createStyles>;
}

const ItemsTabContent: React.FC<ItemsTabContentProps> = ({
  expenses,
  getParticipant,
  theme,
  styles,
}) => {
  if (expenses.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="receipt-outline" size={32} color={theme.colors.textMuted} />
        <Text style={styles.emptyCardTitle}>Позиции не найдены</Text>
        <Text style={styles.emptyCardSub}>В этой архивной тусовке нет сохранённых покупок.</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentWrap}>
      {expenses.map((item, index) => {
        const buyer = getParticipant(item.paidById);
        const buyerName = buyer?.name || 'Неизвестный участник';
        const categoryKey = item.category || 'other';
        const iconName = CATEGORY_ICONS[categoryKey] || 'receipt-outline';
        const catLabel = CATEGORY_LABELS[categoryKey] || 'Расход';

        const splitCount = (item.splitBetween || []).length;
        const sharePerPerson =
          splitCount > 0 ? (Number(item.amount) || 0) / splitCount : Number(item.amount) || 0;

        return (
          <View key={item.id || `item-${index}`} style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <View style={styles.categoryIconWrap}>
                <Ionicons name={iconName} size={18} color={theme.colors.primary} />
              </View>

              <View style={styles.itemTitleBlock}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{catLabel}</Text>
                </View>
              </View>

              <Text style={styles.itemAmount}>{formatRubles(item.amount)}</Text>
            </View>

            <View style={styles.itemDetailsDivider} />

            {/* Buyer and split details */}
            <View style={styles.itemBottomBlock}>
              {/* Paid By */}
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMetaLabel}>Оплатил(а):</Text>
                <View style={styles.buyerPill}>
                  <View
                    style={[
                      styles.avatarMicro,
                      {
                        backgroundColor:
                          buyer?.avatarColor || getAvatarColor(buyerName),
                      },
                    ]}
                  >
                    <Text style={styles.avatarMicroText}>{getInitials(buyerName)}</Text>
                  </View>
                  <Text style={styles.buyerName} numberOfLines={1}>
                    {buyerName}
                  </Text>
                </View>
              </View>

              {/* Split Between */}
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMetaLabel}>
                  Скидывались ({splitCount}):
                </Text>
                <Text style={styles.sharePerPerson}>
                  {formatRubles(sharePerPerson)} / чел.
                </Text>
              </View>

              {/* Participants chips */}
              <View style={styles.splitChipsWrap}>
                {(item.splitBetween || []).map((split, sIdx) => {
                  const part = getParticipant(split.userId);
                  const pName = part?.name || `ID ${split.userId.slice(0, 4)}`;
                  return (
                    <View key={`${split.userId}-${sIdx}`} style={styles.splitParticipantChip}>
                      <View
                        style={[
                          styles.avatarMicro,
                          {
                            backgroundColor:
                              part?.avatarColor || getAvatarColor(pName),
                          },
                        ]}
                      >
                        <Text style={styles.avatarMicroText}>{getInitials(pName)}</Text>
                      </View>
                      <Text style={styles.splitChipText} numberOfLines={1}>
                        {pName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/* ========================================================================= */
/* TAB 3: PARTICIPANTS BALANCE & STATUS                                      */
/* ========================================================================= */
interface MembersTabContentProps {
  calculation: ReturnType<typeof calculateBalances>;
  theme: ThemeTokens;
  styles: ReturnType<typeof createStyles>;
  onCopy: (text: string, label: string) => void;
}

const MembersTabContent: React.FC<MembersTabContentProps> = ({
  calculation,
  theme,
  styles,
  onCopy,
}) => {
  if (calculation.balances.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="people-outline" size={32} color={theme.colors.textMuted} />
        <Text style={styles.emptyCardTitle}>Список участников пуст</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContentWrap}>
      {calculation.balances.map((record) => {
        const { participant, totalPaid, totalConsumed, netBalance } = record;
        const phone = cleanPhone(participant.phone);

        // Find transfers where this participant is debtor (must pay)
        const outgoingTransfers = calculation.transfers.filter(
          (t) => t.fromUser.id === participant.id
        );
        const hasUnsettledDebt = outgoingTransfers.some((t) => !t.isSettled);

        let balanceType: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (netBalance > 0.009) balanceType = 'positive';
        else if (netBalance < -0.009) balanceType = 'negative';

        return (
          <View key={participant.id} style={styles.memberCard}>
            {/* Top row: Profile & Requisites */}
            <View style={styles.memberHeaderRow}>
              <View
                style={[
                  styles.memberAvatar,
                  {
                    backgroundColor:
                      participant.avatarColor || getAvatarColor(participant.name),
                  },
                ]}
              >
                <Text style={styles.memberAvatarText}>
                  {getInitials(participant.name)}
                </Text>
              </View>

              <View style={styles.memberInfoCol}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {participant.name}
                </Text>
                <View style={styles.memberMetaRow}>
                  {participant.bank ? (
                    <Text style={styles.memberMetaText}>{participant.bank}</Text>
                  ) : null}
                  {participant.bank && phone ? (
                    <Text style={styles.memberMetaDot}>•</Text>
                  ) : null}
                  {phone ? (
                    <TouchableOpacity
                      onPress={() => onCopy(`+${phone}`, 'Телефон')}
                      activeOpacity={0.7}
                      style={styles.inlinePhoneBtn}
                    >
                      <Text style={styles.memberPhoneText}>
                        {formatPhone(participant.phone)}
                      </Text>
                      <Ionicons name="copy-outline" size={10} color={theme.colors.info} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Status Badge */}
              <View
                style={[
                  styles.balanceBadge,
                  balanceType === 'positive' && styles.balanceBadgePositive,
                  balanceType === 'negative' && styles.balanceBadgeNegative,
                  balanceType === 'neutral' && styles.balanceBadgeNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.balanceBadgeText,
                    balanceType === 'positive' && { color: theme.colors.success },
                    balanceType === 'negative' && { color: theme.colors.danger },
                    balanceType === 'neutral' && { color: theme.colors.textMuted },
                  ]}
                >
                  {balanceType === 'positive'
                    ? `+${formatRubles(netBalance)}`
                    : balanceType === 'negative'
                    ? `-${formatRubles(Math.abs(netBalance))}`
                    : '0 ₽'}
                </Text>
              </View>
            </View>

            {/* Middle row: Stats of Paid vs Consumed */}
            <View style={styles.memberStatsRow}>
              <View style={styles.memberStatBlock}>
                <Text style={styles.memberStatLabel}>Внёс за всех</Text>
                <Text style={styles.memberStatValue}>{formatRubles(totalPaid)}</Text>
              </View>
              <View style={styles.memberStatDivider} />
              <View style={styles.memberStatBlock}>
                <Text style={styles.memberStatLabel}>Потребил</Text>
                <Text style={styles.memberStatValue}>{formatRubles(totalConsumed)}</Text>
              </View>
              <View style={styles.memberStatDivider} />
              <View style={styles.memberStatBlock}>
                <Text style={styles.memberStatLabel}>Итог</Text>
                <Text
                  style={[
                    styles.memberStatValue,
                    balanceType === 'positive' && { color: theme.colors.success },
                    balanceType === 'negative' && { color: theme.colors.warning },
                  ]}
                >
                  {balanceType === 'positive'
                    ? 'Ему должны'
                    : balanceType === 'negative'
                    ? 'Должен вернуть'
                    : 'В расчёте'}
                </Text>
              </View>
            </View>

            {/* Settlement Status Footer */}
            {outgoingTransfers.length > 0 ? (
              <View style={styles.memberTransfersFooter}>
                <Text style={styles.transfersFooterLabel}>
                  Статус оплат долга:
                </Text>
                {outgoingTransfers.map((t) => (
                  <View key={t.id} style={styles.miniTransferItem}>
                    <Ionicons
                      name={t.isSettled ? 'checkmark-circle' : 'time-outline'}
                      size={13}
                      color={t.isSettled ? theme.colors.success : theme.colors.warning}
                    />
                    <Text style={styles.miniTransferText}>
                      {formatRubles(t.amount)} в пользу {t.toUser.name} —{' '}
                      <Text
                        style={{
                          color: t.isSettled ? theme.colors.success : theme.colors.warning,
                          fontWeight: '600',
                        }}
                      >
                        {t.isSettled ? 'Оплачено' : 'Ожидает оплаты'}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : netBalance > 0 ? (
              <View style={styles.creditorFooter}>
                <Ionicons
                  name={hasUnsettledDebt ? 'hourglass-outline' : 'checkmark-done'}
                  size={13}
                  color={theme.colors.info}
                />
                <Text style={styles.creditorFooterText}>
                  Получатель средств по финальному расчёту
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

/* ========================================================================= */
/* STYLESHEET                                                                */
/* ========================================================================= */
function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalBody: {
      flex: 1,
      minHeight: 0,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    headerTitleWrap: {
      flex: 1,
      paddingRight: theme.spacing.md,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: 4,
    },
    readOnlyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.info}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.info}33`,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    readOnlyText: {
      color: theme.colors.info,
      fontSize: 10,
      fontWeight: '700',
    },
    roomCodeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}33`,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    roomCodeText: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
    },
    partyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    partyDate: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    actionCircleBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    quickOverviewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    overviewCol: {
      flex: 1,
      alignItems: 'center',
    },
    overviewDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.colors.surfaceBorder,
    },
    overviewLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginBottom: 3,
    },
    overviewAmount: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    overviewValue: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
      backgroundColor: 'transparent',
    },
    tabButtonActive: {
      backgroundColor: `${theme.colors.primary}1A`,
    },
    tabButtonText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    tabButtonTextActive: {
      color: theme.colors.primary,
      fontWeight: '800',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxxl + 40,
    },
    tabContentWrap: {
      gap: theme.spacing.md,
    },
    settlementStatusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
    },
    settlementCardDone: {
      backgroundColor: `${theme.colors.success}10`,
      borderColor: `${theme.colors.success}33`,
    },
    settlementCardPending: {
      backgroundColor: `${theme.colors.warning}10`,
      borderColor: `${theme.colors.warning}33`,
    },
    settlementTextWrap: {
      flex: 1,
    },
    settlementTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    settlementSub: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    sectionCounter: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    transferCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
    },
    transferCardSettled: {
      opacity: 0.85,
      borderColor: `${theme.colors.success}33`,
    },
    transferTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    transferParticipants: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: theme.spacing.sm,
    },
    transferUserName: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      maxWidth: 90,
    },
    transferAmount: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    avatarSmall: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    avatarSmallText: {
      color: theme.colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
    },
    transferBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    statusBadgeSettled: {
      backgroundColor: `${theme.colors.success}18`,
    },
    statusBadgePending: {
      backgroundColor: `${theme.colors.warning}18`,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    requisitePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    requisiteText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
    },
    requisiteCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.info}14`,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    requisiteCopyText: {
      color: theme.colors.info,
      fontSize: 10,
      fontWeight: '600',
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
    },
    emptyCardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    emptyCardSub: {
      color: theme.colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
      maxWidth: 260,
    },
    itemCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
    },
    itemTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    categoryIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}18`,
    },
    itemTitleBlock: {
      flex: 1,
    },
    itemTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    categoryTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      marginTop: 3,
    },
    categoryTagText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontWeight: '600',
    },
    itemAmount: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    itemDetailsDivider: {
      height: 1,
      backgroundColor: theme.colors.surfaceBorder,
      marginVertical: theme.spacing.sm,
    },
    itemBottomBlock: {
      gap: 6,
    },
    itemMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemMetaLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    buyerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    buyerName: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    sharePerPerson: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    splitChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 2,
    },
    splitParticipantChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    splitChipText: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '500',
    },
    avatarMicro: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarMicroText: {
      color: theme.colors.textInverse,
      fontSize: 8,
      fontWeight: '800',
    },
    memberCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    memberHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberAvatarText: {
      color: theme.colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    memberInfoCol: {
      flex: 1,
    },
    memberName: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    memberMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    memberMetaText: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    memberMetaDot: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    inlinePhoneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    memberPhoneText: {
      color: theme.colors.info,
      fontSize: 11,
      fontWeight: '500',
    },
    balanceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
    },
    balanceBadgePositive: {
      backgroundColor: `${theme.colors.success}18`,
      borderColor: `${theme.colors.success}33`,
    },
    balanceBadgeNegative: {
      backgroundColor: `${theme.colors.danger}18`,
      borderColor: `${theme.colors.danger}33`,
    },
    balanceBadgeNeutral: {
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: theme.colors.surfaceBorder,
    },
    balanceBadgeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    memberStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 8,
      paddingHorizontal: theme.spacing.sm,
    },
    memberStatBlock: {
      flex: 1,
      alignItems: 'center',
    },
    memberStatDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.colors.surfaceBorder,
    },
    memberStatLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginBottom: 2,
    },
    memberStatValue: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    memberTransfersFooter: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      padding: 8,
      gap: 4,
    },
    transfersFooterLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 2,
    },
    miniTransferItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    miniTransferText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      flex: 1,
    },
    creditorFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingTop: 2,
    },
    creditorFooterText: {
      color: theme.colors.info,
      fontSize: 11,
      fontWeight: '500',
    },
  });
}
