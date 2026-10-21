import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ShoppingItem, UserProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { formatRubles, getAvatarColor, getInitials } from '../../utils/currency';
import { useToast } from '../common/Toast';
import { PARTY_PRESETS } from './AddShoppingItemModal';

interface ShoppingListViewProps {
  onOpenAddItem: (preset?: (typeof PARTY_PRESETS)[0]) => void;
  onEditItem: (item: ShoppingItem) => void;
  onConvertItem: (item: ShoppingItem) => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'pizza-outline',
  drink: 'beer-outline',
  hookah: 'cloudy-outline',
  delivery: 'car-outline',
  other: 'receipt-outline',
};

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  onOpenAddItem,
  onEditItem,
  onConvertItem,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);
  const deleteShoppingItem = usePartyStore((s) => s.deleteShoppingItem);
  const toggleClaimShoppingItem = usePartyStore((s) => s.toggleClaimShoppingItem);
  const unconvertShoppingItem = usePartyStore((s) => s.unconvertShoppingItem);
  const { showToast } = useToast();

  const [isBoughtCollapsed, setIsBoughtCollapsed] = useState(false);

  const shoppingList = useMemo(
    () => currentParty.shoppingList || [],
    [currentParty.shoppingList]
  );
  const participants = useMemo(
    () => currentParty.participants || [],
    [currentParty.participants]
  );

  const getProfile = (id?: string): UserProfile | undefined =>
    id ? participants.find((p) => p.id === id) : undefined;

  const activeItems = useMemo(
    () => shoppingList.filter((item) => !item.isBought),
    [shoppingList]
  );
  const boughtItems = useMemo(
    () => shoppingList.filter((item) => item.isBought),
    [shoppingList]
  );

  const totalCount = shoppingList.length;
  const boughtCount = boughtItems.length;
  const progressRatio = totalCount > 0 ? boughtCount / totalCount : 0;

  const totalEstimated = shoppingList.reduce(
    (sum, item) => sum + (item.estimatedAmount || 0),
    0
  );
  const totalActual = boughtItems.reduce(
    (sum, item) => sum + (item.actualAmount || item.estimatedAmount || 0),
    0
  );

  const handleDeletePrompt = (item: ShoppingItem) => {
    Alert.alert(
      'Удалить из списка?',
      item.convertedExpenseId
        ? `Пункт «${item.title}» уже внесён в общий чек. При удалении расход также удалится из счёта.`
        : `Удалить «${item.title}» из списка покупок?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            deleteShoppingItem(item.id);
            showToast(`«${item.title}» удалено`, { type: 'info' });
          },
        },
      ]
    );
  };

  const handleUncheckBought = (item: ShoppingItem) => {
    Alert.alert(
      'Вернуть в покупки?',
      `Снять отметку «Куплено» с «${item.title}»? Расход будет удалён из общего чека.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Вернуть',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            unconvertShoppingItem(item.id);
            showToast(`«${item.title}» возвращено в список`, { type: 'info' });
          },
        },
      ]
    );
  };

  const handleToggleClaim = (item: ShoppingItem) => {
    if (!session) {
      showToast('Войдите в профиль, чтобы брать пункты себе', { type: 'warning' });
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleClaimShoppingItem(item.id);
    const willClaim = item.assignedUserId !== session.user.id;
    showToast(
      willClaim
        ? `Вы взяли «${item.title}» на себя! 🙋`
        : `Отметка с «${item.title}» снята`,
      { type: 'info' }
    );
  };

  if (shoppingList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="cart-outline" size={34} color={theme.colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Список покупок пуст</Text>
        <Text style={styles.emptySubtitle}>
          Распределите заранее: шашлык, угли, соки, посуду. А когда кто-то купит — позиция в 1 клик попадёт в общий счёт!
        </Text>

        {/* Quick Presets Carousel */}
        <View style={styles.presetsGridContainer}>
          <Text style={styles.presetsTitle}>ЧАСТО БЕРУТ НА ТУСОВКУ:</Text>
          <View style={styles.presetGrid}>
            {PARTY_PRESETS.slice(0, 6).map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={styles.emptyPresetBtn}
                onPress={() => onOpenAddItem(preset)}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyPresetEmoji}>{preset.emoji}</Text>
                <Text style={styles.emptyPresetText} numberOfLines={1}>
                  {preset.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.emptyAddBtn}
          onPress={() => onOpenAddItem()}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle"
            size={20}
            color={theme.colors.textInverse}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.emptyAddBtnText}>Добавить первый пункт</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress & Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Прогресс сборов</Text>
            <Text style={styles.summarySubtitle}>
              Куплено {boughtCount} из {totalCount} позиций ({Math.round(progressRatio * 100)}%)
            </Text>
          </View>
          <View style={styles.summaryAmounts}>
            {totalActual > 0 ? (
              <Text style={styles.summaryActual}>
                {formatRubles(totalActual)}{' '}
                <Text style={styles.summaryActualLabel}>в чеке</Text>
              </Text>
            ) : totalEstimated > 0 ? (
              <Text style={styles.summaryEstimated}>
                ~{formatRubles(totalEstimated)}{' '}
                <Text style={styles.summaryActualLabel}>план</Text>
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(progressRatio * 100, 4)}%` },
            ]}
          />
        </View>
      </View>

      {/* Quick Presets Row */}
      <View style={styles.quickPresetsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPresetsScroll}
        >
          {PARTY_PRESETS.map((preset, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickPresetChip}
              onPress={() => onOpenAddItem(preset)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickPresetEmoji}>{preset.emoji}</Text>
              <Text style={styles.quickPresetText}>{preset.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Active Items Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          НАДО КУПИТЬ ({activeItems.length})
        </Text>
        <TouchableOpacity
          onPress={() => onOpenAddItem()}
          style={styles.headerAddLink}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={theme.colors.primary} />
          <Text style={styles.headerAddLinkText}>Добавить</Text>
        </TouchableOpacity>
      </View>

      {activeItems.length === 0 ? (
        <View style={styles.allBoughtBanner}>
          <Ionicons
            name="checkmark-done-circle"
            size={24}
            color={theme.colors.success}
          />
          <Text style={styles.allBoughtText}>
            Все позиции куплены и внесены в счёт! 🎉
          </Text>
        </View>
      ) : (
        activeItems.map((item) => {
          const assignedUser = getProfile(item.assignedUserId);
          const isAssignedToMe = session?.user.id === item.assignedUserId;
          const categoryIcon = CATEGORY_ICONS[item.category || 'other'] || 'receipt-outline';

          return (
            <View key={item.id} style={styles.itemCard}>
              {/* Checkbox triggers Convert to Expense flow */}
              <TouchableOpacity
                style={styles.checkboxTouch}
                onPress={() => onConvertItem(item)}
                activeOpacity={0.6}
                accessibilityRole="checkbox"
                accessibilityLabel="Отметить как купленное"
              >
                <View style={styles.checkboxBox}>
                  <Ionicons name="checkmark" size={18} color="transparent" />
                </View>
              </TouchableOpacity>

              {/* Main Info */}
              <View style={styles.itemBody}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.estimatedAmount ? (
                    <Text style={styles.estimatedBadge}>
                      ~{formatRubles(item.estimatedAmount)}
                    </Text>
                  ) : null}
                </View>

                {/* Sub row: Assignee badge or "I'll buy" button */}
                <View style={styles.itemSubRow}>
                  {assignedUser ? (
                    <TouchableOpacity
                      style={[
                        styles.assignedBadge,
                        isAssignedToMe && styles.assignedBadgeMe,
                      ]}
                      onPress={() => handleToggleClaim(item)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.assigneeMiniAvatar,
                          {
                            backgroundColor:
                              assignedUser.avatarColor ||
                              getAvatarColor(assignedUser.name),
                          },
                        ]}
                      >
                        <Text style={styles.assigneeMiniInitials}>
                          {getInitials(assignedUser.name)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.assignedBadgeText,
                          isAssignedToMe && styles.assignedBadgeTextMe,
                        ]}
                        numberOfLines={1}
                      >
                        {isAssignedToMe ? 'Вы покупаете' : `${assignedUser.name} купит`}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => handleToggleClaim(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="hand-right-outline"
                        size={12}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.claimBtnText}>Я куплю!</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.categoryBadge}>
                    <Ionicons
                      name={categoryIcon}
                      size={12}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onEditItem(item)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDeletePrompt(item)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.danger}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Bought Items Section */}
      {boughtItems.length > 0 && (
        <View style={styles.boughtSection}>
          <TouchableOpacity
            style={styles.boughtHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsBoughtCollapsed((prev) => !prev);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.boughtHeaderLeft}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.success}
              />
              <Text style={styles.boughtHeaderText}>
                КУПЛЕНО И В ЧЕКЕ ({boughtItems.length})
              </Text>
            </View>
            <Ionicons
              name={isBoughtCollapsed ? 'chevron-forward' : 'chevron-down'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {!isBoughtCollapsed &&
            boughtItems.map((item) => {
              const payer = getProfile(item.boughtById || item.assignedUserId);
              return (
                <View key={item.id} style={styles.boughtItemCard}>
                  {/* Tapping checkmark prompts uncheck */}
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => handleUncheckBought(item)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.checkboxBoxBought}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.colors.textInverse}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.itemBody}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.boughtItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.actualAmount ? (
                        <Text style={styles.boughtActualAmount}>
                          {formatRubles(item.actualAmount)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.boughtMetaRow}>
                      <View style={styles.inBillTag}>
                        <Ionicons
                          name="receipt-outline"
                          size={11}
                          color={theme.colors.success}
                        />
                        <Text style={styles.inBillTagText}>В чеке</Text>
                      </View>
                      {payer && (
                        <Text style={styles.boughtPayerText}>
                          Оплатил(а) {payer.name}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDeletePrompt(item)}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingBottom: 24,
    },
    summaryCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: 14,
      marginBottom: 12,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    summarySubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    summaryAmounts: {
      alignItems: 'flex-end',
    },
    summaryActual: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.success,
    },
    summaryEstimated: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    summaryActualLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    progressBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceBorder,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.success,
    },
    quickPresetsBar: {
      marginBottom: 14,
    },
    quickPresetsScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    quickPresetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 5,
    },
    quickPresetEmoji: {
      fontSize: 13,
    },
    quickPresetText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
    },
    headerAddLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    headerAddLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    allBoughtBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 10,
      marginBottom: 14,
    },
    allBoughtText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flex: 1,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    checkboxTouch: {
      padding: 4,
      marginRight: 8,
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxBoxBought: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBody: {
      flex: 1,
      marginRight: 6,
    },
    itemTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      flex: 1,
    },
    estimatedBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    itemSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    assignedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceBorder,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 10,
      gap: 4,
      maxWidth: 150,
    },
    assignedBadgeMe: {
      backgroundColor: theme.colors.primaryLight,
    },
    assigneeMiniAvatar: {
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assigneeMiniInitials: {
      fontSize: 7,
      fontWeight: '800',
      color: '#ffffff',
    },
    assignedBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    assignedBadgeTextMe: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    claimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primary,
      gap: 4,
    },
    claimBtnText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    categoryBadge: {
      padding: 2,
    },
    itemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    actionBtn: {
      padding: 6,
    },
    boughtSection: {
      marginTop: 14,
    },
    boughtHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    boughtHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    boughtHeaderText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.success,
    },
    boughtItemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 6,
      opacity: 0.85,
    },
    boughtItemTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textDecorationLine: 'line-through',
      flex: 1,
    },
    boughtActualAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    boughtMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    inBillTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceBorder,
      paddingVertical: 1,
      paddingHorizontal: 5,
      borderRadius: 6,
      gap: 3,
    },
    inBillTagText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.success,
    },
    boughtPayerText: {
      fontSize: 10,
      color: theme.colors.textMuted,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    emptyIconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
      maxWidth: 320,
    },
    presetsGridContainer: {
      width: '100%',
      marginBottom: 20,
    },
    presetsTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
      marginBottom: 8,
      textAlign: 'center',
    },
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    emptyPresetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: 14,
      paddingVertical: 7,
      paddingHorizontal: 12,
      gap: 6,
    },
    emptyPresetEmoji: {
      fontSize: 14,
    },
    emptyPresetText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginTop: 4,
    },
    emptyAddBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textInverse,
    },
  });
}
