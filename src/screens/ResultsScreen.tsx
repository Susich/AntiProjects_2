import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { ThemeTokens, useTheme } from '../context/ThemeContext';
import { usePartyCalculator } from '../hooks/usePartyCalculator';
import { SimplifiedDebtTransfer } from '../types';
import { PartySummaryBanner } from '../components/results/PartySummaryBanner';
import { DebtorCard } from '../components/results/DebtorCard';
import { Button } from '../components/common/Button';
import { formatRubles } from '../utils/currency';
import { useToast } from '../components/common/Toast';
import { FadeSlideIn } from '../components/common/FadeSlideIn';
import { Avatar } from '../components/common/Avatar';

type FilterTab = 'all' | 'pending' | 'settled';

interface ResultsScreenProps {
  onNavigateToParty: () => void;
  onNavigateToProfile: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  onNavigateToParty,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);
  const toggleTransferSettled = usePartyStore((s) => s.toggleTransferSettled);
  const saveCurrentPartyToHistory = usePartyStore((s) => s.saveCurrentPartyToHistory);
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showBalancesDetails, setShowBalancesDetails] = useState(false);

  // Participants are authenticated users in the room, merged with current session
  const partyProfiles = useMemo(() => {
    return (currentParty.participants || []).map((p) =>
      p.id === session?.user.id && session?.user.avatarUrl
        ? { ...p, avatarUrl: session.user.avatarUrl }
        : p
    );
  }, [currentParty.participants, session]);

  // Greedy debt simplification calculator
  const calculation = usePartyCalculator({
    expenses: currentParty.expenses || [],
    participants: partyProfiles,
    settledTransferIds: currentParty.settledTransferIds || [],
  });

  const handleSaveToHistory = () => {
    saveCurrentPartyToHistory();
    showToast('Тусовка сохранена в архив Истории!', { type: 'success' });
  };

  const handleToggleTransfer = async (transfer: SimplifiedDebtTransfer) => {
    const userId = session?.user.id;
    if (userId !== transfer.fromUser.id && userId !== transfer.toUser.id) {
      showToast('Отметить оплату может только должник или получатель', {
        type: 'warning',
      });
      return;
    }
    // Zustand updates and persists immediately; the queue sends the request in
    // the background. A later failure rolls the toggle back and shows a toast
    // from the queue.
    const result = await toggleTransferSettled(transfer);
    if (!result.success) {
      showToast(result.error || 'Не удалось изменить статус перевода', {
        type: 'error',
      });
      return;
    }
    showToast(
      transfer.isSettled ? 'Перевод возвращён в ожидание' : 'Перевод отмечен оплаченным',
      { type: transfer.isSettled ? 'info' : 'success' }
    );
  };

  const participantStatuses = partyProfiles.map((participant) => {
    const outgoing = calculation.transfers.filter((t) => t.fromUser.id === participant.id);
    const incoming = calculation.transfers.filter((t) => t.toUser.id === participant.id);
    const pendingOutgoing = outgoing.filter((t) => !t.isSettled);
    const pendingIncoming = incoming.filter((t) => !t.isSettled);
    const pendingOutgoingAmount = pendingOutgoing.reduce((sum, t) => sum + t.amount, 0);
    const pendingIncomingAmount = pendingIncoming.reduce((sum, t) => sum + t.amount, 0);

    if (outgoing.length === 0 && incoming.length === 0) {
      return {
        participant,
        label: 'В расчёте',
        color: theme.colors.success,
        icon: 'checkmark-circle-outline' as const,
        isPaid: true,
      };
    }
    if (pendingOutgoing.length > 0) {
      return {
        participant,
        label: `Ожидает оплаты ${formatRubles(pendingOutgoingAmount)}`,
        color: theme.colors.warning,
        icon: 'time-outline' as const,
        isPaid: false,
      };
    }
    if (outgoing.length > 0) {
      return {
        participant,
        label: 'Оплачено',
        color: theme.colors.success,
        icon: 'checkmark-done-circle' as const,
        isPaid: true,
      };
    }
    if (pendingIncoming.length > 0) {
      return {
        participant,
        label: `Ждёт перевода ${formatRubles(pendingIncomingAmount)}`,
        color: theme.colors.info,
        icon: 'hourglass-outline' as const,
        isPaid: false,
      };
    }
    return {
      participant,
      label: 'Оплачено',
      color: theme.colors.success,
      icon: 'cash-outline' as const,
      isPaid: true,
    };
  });

  const filteredTransfers = calculation.transfers.filter((t) => {
    if (activeFilter === 'pending') return !t.isSettled;
    if (activeFilter === 'settled') return t.isSettled;
    return true;
  });

  if ((currentParty.expenses || []).length === 0 || partyProfiles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="calculator-outline" size={36} color={theme.colors.neonCyan} />
        </View>
        <Text style={styles.emptyTitle}>
          Недостаточно данных для расчёта
        </Text>
        <Text style={styles.emptySubtitle}>
          {partyProfiles.length === 0
            ? 'Подключите общую комнату — участники появятся автоматически'
            : 'Добавьте хотя бы один счёт на вкладке «Чек & Траты»'}
        </Text>
        <Button
          title="Перейти к добавлению счетов"
          variant="primary"
          icon="add-circle"
          onPress={onNavigateToParty}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Summary Banner */}
        <PartySummaryBanner
          calculation={calculation}
          partyTitle={currentParty.title}
        />

        {/* Transparent Net Balances Accordion */}
        <View style={styles.balancesSection}>
          <TouchableOpacity
            style={styles.balancesToggleRow}
            onPress={() => setShowBalancesDetails((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="swap-vertical"
                size={16}
                color={theme.colors.neonCyan}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.balancesToggleText}>
                Чистый баланс участников ({calculation.balances.length} чел.)
              </Text>
            </View>
            <Ionicons
              name={showBalancesDetails ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {showBalancesDetails && (
            <View style={styles.balancesList}>
              {calculation.balances.map((b) => {
                const isCreditor = b.netBalance > 0.01;
                const isDebtor = b.netBalance < -0.01;

                return (
                  <View key={b.participant.id} style={styles.balanceItemRow}>
                    <View style={styles.balanceUserLeft}>
                      <Avatar
                        url={b.participant.avatarUrl}
                        name={b.participant.name}
                        color={b.participant.avatarColor}
                        size={38}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.balanceUserName}>
                          {b.participant.name}
                        </Text>
                        <Text style={styles.balanceUserSub}>
                          Оплатил: {formatRubles(b.totalPaid)} • Потребил: {formatRubles(b.totalConsumed)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.balanceAmountContainer}>
                      <Text
                        style={[
                          styles.balanceNetText,
                          {
                            color: isCreditor
                              ? theme.colors.neonEmerald
                              : isDebtor
                              ? theme.colors.neonPink
                              : theme.colors.textSecondary,
                          },
                        ]}
                      >
                        {isCreditor ? `+${formatRubles(b.netBalance)}` : formatRubles(b.netBalance)}
                      </Text>
                      <Text style={styles.balanceNetRole}>
                        {isCreditor ? 'Кредитор' : isDebtor ? 'Должник' : 'В расчёте'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Participant payment status — who has paid and who is still waiting. */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <View style={styles.statusHeaderLeft}>
              <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.statusTitle}>
                Статусы участников
              </Text>
            </View>
            <Text style={styles.statusSubtitle}>
              в реальном времени
            </Text>
          </View>

          {participantStatuses.map((status) => (
            <View key={status.participant.id} style={styles.statusRow}>
              <Avatar
                url={status.participant.avatarUrl}
                name={status.participant.name}
                color={status.participant.avatarColor}
                size={36}
              />
              <View style={styles.statusInfo}>
                <Text style={styles.statusName}>
                  {status.participant.name}
                </Text>
                <Text style={[styles.statusLabel, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
              {status.isPaid ? (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={theme.colors.success} />
                  <Text style={styles.paidBadgeText}>Оплачено</Text>
                </View>
              ) : (
                <Ionicons name={status.icon} size={19} color={status.color} />
              )}
            </View>
          ))}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === 'all' && styles.filterTextActive,
              ]}
            >
              Все переводы ({calculation.transfers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('pending')}
            style={[styles.filterPill, activeFilter === 'pending' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === 'pending' && styles.filterTextActive,
              ]}
            >
              Ожидают ({calculation.pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('settled')}
            style={[styles.filterPill, activeFilter === 'settled' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === 'settled' && styles.filterTextActive,
              ]}
            >
              Оплачено ({calculation.settledCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* All Debts Settled Celebration Card */}
        {calculation.transfers.length > 0 && calculation.pendingCount === 0 && (
          <View style={styles.allSettledCard}>
            <Ionicons name="trophy-outline" size={32} color={theme.colors.success} />
            <Text style={styles.allSettledTitle}>
              Все расчёты закрыты! 🎉
            </Text>
            <Text style={styles.allSettledSub}>
              Все участники перевели свои доли. Вы можете завершить тусовку и отправить её в архив.
            </Text>
            <Button
              title="Завершить и сохранить в архив"
              variant="neon"
              size="md"
              icon="archive"
              onPress={handleSaveToHistory}
              style={{ marginTop: 6, width: '100%' }}
            />
          </View>
        )}

        {/* Transfer Cards */}
        <View style={styles.transfersList}>
          {filteredTransfers.length === 0 ? (
            <View style={styles.noDebtorsFiltered}>
              <Ionicons name="checkmark-done-circle" size={36} color={theme.colors.neonEmerald} />
              <Text style={styles.noDebtorsText}>
                {calculation.transfers.length === 0
                  ? 'Все расходы уравновешены! Никто никому ничего не должен 🎉'
                  : activeFilter === 'pending'
                  ? 'Все долги закрыты! Все участники перевели деньги 🎉'
                  : 'Пока никто не оплатил'}
              </Text>
            </View>
          ) : (
            filteredTransfers.map((transfer, index) => (
              <FadeSlideIn key={transfer.id} index={index}>
                <DebtorCard
                  transfer={transfer}
                  partyTitle={currentParty.title}
                  onToggleSettled={handleToggleTransfer}
                />
              </FadeSlideIn>
            ))
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          <Button
            title="Сохранить тусовку в архив"
            variant="secondary"
            size="md"
            icon="archive-outline"
            onPress={handleSaveToHistory}
            style={{ marginBottom: 12 }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    screenContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 64,
    },
    balancesSection: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 16,
      overflow: 'hidden',
    },
    balancesToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
    },
    balancesToggleText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    balancesList: {
      paddingHorizontal: 14,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
    balanceItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    balanceUserLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    balanceAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    balanceAvatarText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textInverse,
    },
    balanceUserName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    balanceUserSub: {
      fontSize: 10,
      marginTop: 1,
      color: theme.colors.textMuted,
    },
    balanceAmountContainer: {
      alignItems: 'flex-end',
    },
    balanceNetText: {
      fontSize: 13,
      fontWeight: '800',
    },
    balanceNetRole: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    statusSection: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 16,
      overflow: 'hidden',
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statusHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    statusSubtitle: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
      gap: 9,
    },
    statusAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusAvatarText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textInverse,
    },
    statusInfo: {
      flex: 1,
    },
    statusName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    statusLabel: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 1,
    },
    paidBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: `${theme.colors.success}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}50`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    paidBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.success,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    filterPill: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
    },
    filterPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    filterTextActive: {
      color: theme.colors.textInverse,
      fontWeight: '700',
    },
    transfersList: {
      marginBottom: 16,
    },
    noDebtorsFiltered: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      marginVertical: 10,
    },
    noDebtorsText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
      color: theme.colors.neonEmerald,
    },
    bottomSection: {
      marginTop: 8,
    },
    allSettledCard: {
      backgroundColor: `${theme.colors.success}14`,
      borderColor: `${theme.colors.success}44`,
      borderRadius: 16,
      borderWidth: 1.5,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      gap: 6,
    },
    allSettledTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginTop: 2,
      textAlign: 'center',
      color: theme.colors.textPrimary,
    },
    allSettledSub: {
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      maxWidth: 290,
      marginBottom: 8,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      backgroundColor: theme.colors.background,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.colors.neonCyan}18`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
  });
}
