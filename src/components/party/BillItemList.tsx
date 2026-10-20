import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ExpenseItem, ParticipantProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { formatRubles, getInitials } from '../../utils/currency';
import { useToast } from '../common/Toast';

interface BillItemListProps {
  onEditItem: (item: ExpenseItem) => void;
  onOpenAddItem: () => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'pizza-outline',
  drink: 'beer-outline',
  hookah: 'cloudy-outline',
  delivery: 'car-outline',
  other: 'receipt-outline',
};

export const BillItemList: React.FC<BillItemListProps> = ({
  onEditItem,
  onOpenAddItem,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentParty = usePartyStore((s) => s.currentParty);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const removeExpense = usePartyStore((s) => s.removeExpense);
  const { showToast } = useToast();

  const getProfile = (id: string): ParticipantProfile | undefined =>
    savedProfiles.find((p) => p.id === id);

  const handleDeletePrompt = (item: ExpenseItem) => {
    Alert.alert(
      'Удалить расход?',
      `Вы действительно хотите удалить «${item.title}» (${formatRubles(item.amount)})?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            removeExpense(item.id);
            showToast(`«${item.title}» удалено из чека`, { type: 'info' });
          },
        },
      ]
    );
  };

  const expenses = currentParty.expenses || [];

  if (expenses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="receipt-outline" size={32} color={theme.colors.info} />
        </View>
        <Text style={styles.emptyTitle}>В чеке пока нет расходов</Text>
        <Text style={styles.emptySubtitle}>
          Добавляйте покупки: кто за что платил и кто в этом участвовал
        </Text>
        <TouchableOpacity
          style={styles.emptyAddBtn}
          onPress={onOpenAddItem}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle"
            size={18}
            color={theme.colors.textInverse}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.emptyAddBtnText}>Добавить первый счёт</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Расходы за вечер</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{expenses.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onOpenAddItem}
          style={styles.addMiniBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={theme.colors.textInverse} />
          <Text style={styles.addMiniText}>Расход</Text>
        </TouchableOpacity>
      </View>

      {expenses.map((expense) => {
        const payer = getProfile(expense.paidById);

        const sharedProfiles = (expense.splitBetween || [])
          .map((s) => getProfile(s.userId))
          .filter(Boolean) as ParticipantProfile[];

        const consumerCount = sharedProfiles.length;
        const sharePerPerson =
          consumerCount > 0
            ? Math.round((expense.amount / consumerCount) * 100) / 100
            : 0;

        const iconName = CATEGORY_ICONS[expense.category || 'other'] || 'receipt-outline';

        return (
          <View key={expense.id} style={styles.itemCard}>
            <View style={styles.itemMainRow}>
              <View style={styles.iconCircle}>
                <Ionicons name={iconName} size={18} color={theme.colors.primary} />
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{expense.title}</Text>

                {/* Who Paid Badge */}
                <View style={styles.payerBadgeRow}>
                  <Text style={styles.payerLabel}>Оплатил(а): </Text>
                  {payer ? (
                    <View style={styles.payerInlineChip}>
                      <View
                        style={[
                          styles.payerMiniAvatar,
                          {
                            backgroundColor: payer.avatarColor || theme.colors.primary,
                          },
                        ]}
                      >
                        <Text style={styles.payerMiniAvatarText}>
                          {getInitials(payer.name)}
                        </Text>
                      </View>
                      <Text style={styles.payerNameText}>{payer.name}</Text>
                    </View>
                  ) : (
                    <Text style={styles.payerUnknownText}>Не указан</Text>
                  )}
                </View>

                {/* Split Info */}
                <View style={styles.splitSubRow}>
                  {consumerCount === 0 ? (
                    <Text style={styles.unassignedWarning}>Никто не выбран</Text>
                  ) : consumerCount === currentParty.participants.length &&
                    currentParty.participants.length > 0 ? (
                    <Text style={styles.splitAllText}>
                      Скинулись все ({consumerCount}) • по {formatRubles(sharePerPerson)}
                    </Text>
                  ) : (
                    <Text style={styles.splitPartText}>
                      Делят {consumerCount} чел. • по {formatRubles(sharePerPerson)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>{formatRubles(expense.amount)}</Text>
              </View>
            </View>

            {/* Participants Avatars Bar */}
            <View style={styles.itemFooterRow}>
              <View style={styles.avatarsRow}>
                {sharedProfiles.slice(0, 5).map((p, idx) => (
                  <View
                    key={p.id}
                    style={[
                      styles.avatarBubble,
                      {
                        backgroundColor: p.avatarColor || theme.colors.info,
                        marginLeft: idx > 0 ? -6 : 0,
                      },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(p.name)}</Text>
                  </View>
                ))}
                {sharedProfiles.length > 5 && (
                  <View style={[styles.avatarBubble, styles.avatarMore, { marginLeft: -6 }]}>
                    <Text style={styles.avatarMoreText}>+{sharedProfiles.length - 5}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => onEditItem(expense)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.actionBtn}
                >
                  <Ionicons name="create-outline" size={17} color={theme.colors.info} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeletePrompt(expense)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.actionBtn, { marginLeft: 12 }]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={theme.colors.neonPink}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    listContainer: {
      marginBottom: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    countBadge: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.info,
    },
    addMiniBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      paddingVertical: 5,
      paddingHorizontal: 12,
      ...theme.shadows.neonGreen,
    },
    addMiniText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textInverse,
      marginLeft: 3,
    },
    itemCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.lg,
      padding: 14,
      marginBottom: 10,
      ...theme.shadows.card,
    },
    itemMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: `${theme.colors.primary}1A`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemInfo: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    payerBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      flexWrap: 'wrap',
    },
    payerLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    payerInlineChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: theme.borderRadius.full,
    },
    payerMiniAvatar: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    payerMiniAvatarText: {
      fontSize: 8,
      fontWeight: '900',
      color: theme.colors.textInverse,
    },
    payerNameText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    payerUnknownText: {
      fontSize: 11,
      color: theme.colors.neonPink,
    },
    splitSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    splitAllText: {
      fontSize: 12,
      color: theme.colors.info,
      fontWeight: '500',
    },
    splitPartText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    unassignedWarning: {
      fontSize: 12,
      color: theme.colors.neonPink,
      fontWeight: '500',
    },
    priceContainer: {
      marginLeft: 8,
    },
    priceText: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    itemFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
    avatarsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarBubble: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      color: theme.colors.textInverse,
      fontSize: 9,
      fontWeight: '800',
    },
    avatarMore: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    avatarMoreText: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontWeight: '700',
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionBtn: {
      padding: 4,
    },
    emptyContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderStyle: 'dashed',
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyIconCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: `${theme.colors.info}1A`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: theme.borderRadius.md,
      ...theme.shadows.neonGreen,
    },
    emptyAddBtnText: {
      color: theme.colors.textInverse,
      fontWeight: '700',
      fontSize: 14,
    },
  });
