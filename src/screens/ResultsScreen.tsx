import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { useTheme } from '../context/ThemeContext';
import { usePartyCalculator } from '../hooks/usePartyCalculator';
import { ParticipantProfile } from '../types';
import { PartySummaryBanner } from '../components/results/PartySummaryBanner';
import { DebtorCard } from '../components/results/DebtorCard';
import { Button } from '../components/common/Button';
import { formatRubles, getInitials } from '../utils/currency';
import { useToast } from '../components/common/Toast';

type FilterTab = 'all' | 'pending' | 'settled';

interface ResultsScreenProps {
  onNavigateToParty: () => void;
  onNavigateToProfile: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  onNavigateToParty,
  onNavigateToProfile,
}) => {
  const { theme } = useTheme();
  const currentParty = usePartyStore((s) => s.currentParty);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const toggleTransferSettled = usePartyStore((s) => s.toggleTransferSettled);
  const saveCurrentPartyToHistory = usePartyStore((s) => s.saveCurrentPartyToHistory);
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showBalancesDetails, setShowBalancesDetails] = useState(false);

  // Resolve participants in active party
  const partyProfiles = currentParty.participants
    .map((id) => savedProfiles.find((p) => p.id === id))
    .filter(Boolean) as ParticipantProfile[];

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

  const filteredTransfers = calculation.transfers.filter((t) => {
    if (activeFilter === 'pending') return !t.isSettled;
    if (activeFilter === 'settled') return t.isSettled;
    return true;
  });

  if ((currentParty.expenses || []).length === 0 || partyProfiles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: `${theme.colors.neonCyan}18` },
          ]}
        >
          <Ionicons name="calculator-outline" size={36} color={theme.colors.neonCyan} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
          Недостаточно данных для расчёта
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
          {partyProfiles.length === 0
            ? 'Добавьте хотя бы одного участника в тусовку'
            : 'Добавьте хотя бы один счёт на вкладке «Чек & Люди»'}
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
    <View style={[styles.screenContainer, { backgroundColor: theme.colors.background }]}>
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
        <View
          style={[
            styles.balancesSection,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
            },
          ]}
        >
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
              <Text style={[styles.balancesToggleText, { color: theme.colors.textPrimary }]}>
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
            <View
              style={[
                styles.balancesList,
                { borderTopColor: theme.colors.surfaceBorder },
              ]}
            >
              {calculation.balances.map((b) => {
                const isCreditor = b.netBalance > 0.01;
                const isDebtor = b.netBalance < -0.01;

                return (
                  <View
                    key={b.participant.id}
                    style={[
                      styles.balanceItemRow,
                      { borderBottomColor: theme.colors.surfaceBorder },
                    ]}
                  >
                    <View style={styles.balanceUserLeft}>
                      <View
                        style={[
                          styles.balanceAvatar,
                          { backgroundColor: b.participant.avatarColor || theme.colors.primary },
                        ]}
                      >
                        <Text style={[styles.balanceAvatarText, { color: theme.colors.textInverse }]}>
                          {getInitials(b.participant.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.balanceUserName, { color: theme.colors.textPrimary }]}>
                          {b.participant.name}
                        </Text>
                        <Text style={[styles.balanceUserSub, { color: theme.colors.textMuted }]}>
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
                      <Text style={[styles.balanceNetRole, { color: theme.colors.textMuted }]}>
                        {isCreditor ? 'Кредитор' : isDebtor ? 'Должник' : 'В расчёте'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            style={[
              styles.filterPill,
              {
                backgroundColor: activeFilter === 'all' ? theme.colors.primary : theme.colors.surface,
                borderColor: activeFilter === 'all' ? theme.colors.primary : theme.colors.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'all' ? theme.colors.textInverse : theme.colors.textSecondary },
                activeFilter === 'all' && { fontWeight: '700' },
              ]}
            >
              Все переводы ({calculation.transfers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('pending')}
            style={[
              styles.filterPill,
              {
                backgroundColor: activeFilter === 'pending' ? theme.colors.primary : theme.colors.surface,
                borderColor: activeFilter === 'pending' ? theme.colors.primary : theme.colors.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'pending' ? theme.colors.textInverse : theme.colors.textSecondary },
                activeFilter === 'pending' && { fontWeight: '700' },
              ]}
            >
              Ожидают ({calculation.pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('settled')}
            style={[
              styles.filterPill,
              {
                backgroundColor: activeFilter === 'settled' ? theme.colors.primary : theme.colors.surface,
                borderColor: activeFilter === 'settled' ? theme.colors.primary : theme.colors.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'settled' ? theme.colors.textInverse : theme.colors.textSecondary },
                activeFilter === 'settled' && { fontWeight: '700' },
              ]}
            >
              Оплачено ({calculation.settledCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transfer Cards */}
        <View style={styles.transfersList}>
          {filteredTransfers.length === 0 ? (
            <View
              style={[
                styles.noDebtorsFiltered,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="checkmark-done-circle" size={36} color={theme.colors.neonEmerald} />
              <Text style={[styles.noDebtorsText, { color: theme.colors.neonEmerald }]}>
                {calculation.transfers.length === 0
                  ? 'Все расходы уравновешены! Никто никому ничего не должен 🎉'
                  : activeFilter === 'pending'
                  ? 'Все долги закрыты! Все участники перевели деньги 🎉'
                  : 'Пока никто не оплатил'}
              </Text>
            </View>
          ) : (
            filteredTransfers.map((transfer) => (
              <DebtorCard
                key={transfer.id}
                transfer={transfer}
                partyTitle={currentParty.title}
                onToggleSettled={toggleTransferSettled}
              />
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

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  balancesSection: {
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
  },
  balancesList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  balanceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
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
  },
  balanceUserName: {
    fontSize: 13,
    fontWeight: '600',
  },
  balanceUserSub: {
    fontSize: 10,
    marginTop: 1,
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
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transfersList: {
    marginBottom: 16,
  },
  noDebtorsFiltered: {
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
  },
  bottomSection: {
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
