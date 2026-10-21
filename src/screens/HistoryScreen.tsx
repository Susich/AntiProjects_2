import React, { useMemo, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { ThemeTokens, useTheme } from '../context/ThemeContext';
import { PartyEvent } from '../types';
import { formatRubles } from '../utils/currency';
import { useToast } from '../components/common/Toast';
import { ArchiveDetailModal } from '../components/history/ArchiveDetailModal';
import { FadeSlideIn } from '../components/common/FadeSlideIn';
import { PressableScale } from '../components/common/PressableScale';

export const HistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const history = usePartyStore((s) => s.history);
  const deleteHistoryParty = usePartyStore((s) => s.deleteHistoryParty);
  const { showToast } = useToast();

  const [selectedParty, setSelectedParty] = useState<PartyEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const calculatePartyTotal = (party: PartyEvent): number =>
    (party.expenses || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

  const handleOpenDetail = (party: PartyEvent) => {
    setSelectedParty(party);
    setIsDetailOpen(true);
  };

  const handleDeleteParty = (party: PartyEvent) => {
    Alert.alert(
      'Удалить из архива?',
      `Вы действительно хотите удалить запись «${party.title}»?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            if (selectedParty?.id === party.id) {
              setIsDetailOpen(false);
              setSelectedParty(null);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            deleteHistoryParty(party.id);
            showToast('Запись удалена из архива', { type: 'info' });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Архив тусовок</Text>
          <Text style={styles.subtitle}>
            Нажмите на тусовку для детального просмотра счетов, товаров и участников
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{history.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Архив пуст</Text>
            <Text style={styles.emptySubtitle}>
              Сохраните текущую тусовку из меню комнаты — она появится здесь вместе
              с итоговой суммой и участниками.
            </Text>
          </View>
        ) : (
          history.map((party, index) => {
            const total = calculatePartyTotal(party);
            const parsedDate = Date.parse(party.date);
            const dateStr = Number.isFinite(parsedDate)
              ? new Date(parsedDate).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : '';

            return (
              <FadeSlideIn key={party.id} index={index}>
                <PressableScale
                  style={styles.partyCard}
                  onPress={() => handleOpenDetail(party)}
                  haptic
                  accessibilityRole="button"
                  accessibilityLabel={`Открыть детальный отчёт: ${party.title}`}
                >
                  <View style={styles.partyCardHeader}>
                    <View style={styles.partyTitleBlock}>
                      <Text style={styles.partyCardTitle} numberOfLines={1}>
                        {party.title}
                      </Text>
                      <Text style={styles.partyCardDate}>{dateStr}</Text>
                    </View>
                    <PressableScale
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteParty(party);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Удалить ${party.title}`}
                    >
                      <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                    </PressableScale>
                  </View>

                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Общий чек</Text>
                    <View style={styles.amountWithChevron}>
                      <Text style={styles.partyCardAmount}>{formatRubles(total)}</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.partyStatsRow}>
                    <View style={styles.partyStatPill}>
                      <Ionicons
                        name="people-outline"
                        size={13}
                        color={theme.colors.info}
                      />
                      <Text style={styles.partyStatText}>
                        {party.participants.length} чел.
                      </Text>
                    </View>
                    <View style={styles.partyStatPill}>
                      <Ionicons
                        name="receipt-outline"
                        size={13}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.partyStatText}>
                        {party.expenses.length} позиций
                      </Text>
                    </View>
                    {party.code ? (
                      <View style={styles.partyStatPill}>
                        <Ionicons
                          name="cloud-done-outline"
                          size={13}
                          color={theme.colors.success}
                        />
                        <Text style={styles.partyStatText}>{party.code}</Text>
                      </View>
                    ) : null}
                  </View>

                  {party.participants.length > 0 ? (
                    <View style={styles.footerRow}>
                      <Text style={styles.participantsLine} numberOfLines={1}>
                        {party.participants.map((participant) => participant.name).join(' · ')}
                      </Text>
                      <Text style={styles.detailsHint}>Детали →</Text>
                    </View>
                  ) : (
                    <View style={styles.footerRow}>
                      <Text style={styles.detailsHint}>Нажмите для просмотра →</Text>
                    </View>
                  )}
                </PressableScale>
              </FadeSlideIn>
            );
          })
        )}
      </ScrollView>

      {/* Interactive Detail Modal in Read-Only Mode */}
      <ArchiveDetailModal
        visible={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        party={selectedParty}
      />
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
      maxWidth: 290,
    },
    counter: {
      minWidth: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}44`,
    },
    counterText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 64,
      gap: theme.spacing.md,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xxl,
      marginTop: theme.spacing.xl,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      marginTop: theme.spacing.md,
    },
    emptySubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 6,
    },
    partyCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
    },
    partyCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    partyTitleBlock: {
      flex: 1,
    },
    partyCardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    partyCardDate: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    deleteButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.danger}12`,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.md,
    },
    amountLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    partyCardAmount: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    amountWithChevron: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    partyStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    partyStatPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    partyStatText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontWeight: '500',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    participantsLine: {
      color: theme.colors.textMuted,
      fontSize: 11,
      flex: 1,
    },
    detailsHint: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
