import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ShoppingItem, UserProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { formatRubles, getAvatarColor, getInitials } from '../../utils/currency';
import { useToast } from '../common/Toast';

interface ConvertShoppingModalProps {
  visible: boolean;
  onClose: () => void;
  item: ShoppingItem | null;
}

export const ConvertShoppingModal: React.FC<ConvertShoppingModalProps> = ({
  visible,
  onClose,
  item,
}) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    height="86%"
    maxHeight="92%"
  >
    {({ onScroll }) =>
      item ? (
        <ConvertShoppingForm
          key={item.id}
          onClose={onClose}
          item={item}
          onScroll={onScroll}
        />
      ) : null
    }
  </BottomSheetModal>
);

interface ConvertShoppingFormProps {
  onClose: () => void;
  item: ShoppingItem;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ConvertShoppingForm: React.FC<ConvertShoppingFormProps> = ({
  onClose,
  item,
  onScroll,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);
  const convertShoppingItemToExpense = usePartyStore(
    (s) => s.convertShoppingItemToExpense
  );
  const { showToast } = useToast();

  const partyProfiles: UserProfile[] = useMemo(
    () => currentParty.participants || [],
    [currentParty.participants]
  );

  // Default payer: assigned user, or current user, or first participant
  const defaultPayerId = useMemo(() => {
    if (item.assignedUserId && partyProfiles.some((p) => p.id === item.assignedUserId)) {
      return item.assignedUserId;
    }
    if (session && partyProfiles.some((p) => p.id === session.user.id)) {
      return session.user.id;
    }
    return partyProfiles[0]?.id || '';
  }, [item.assignedUserId, partyProfiles, session]);

  const [actualAmount, setActualAmount] = useState<string>(
    item.actualAmount
      ? String(item.actualAmount)
      : item.estimatedAmount
      ? String(item.estimatedAmount)
      : ''
  );
  const [paidById, setPaidById] = useState<string>(defaultPayerId);
  const [selectedConsumerIds, setSelectedConsumerIds] = useState<string[]>(
    partyProfiles.map((p) => p.id)
  );
  const [amountError, setAmountError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleConsumer = (id: string) => {
    setSelectedConsumerIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const isAllConsumersSelected =
    partyProfiles.length > 0 && selectedConsumerIds.length === partyProfiles.length;

  const handleToggleAll = () => {
    if (isAllConsumersSelected) {
      setSelectedConsumerIds([]);
    } else {
      setSelectedConsumerIds(partyProfiles.map((p) => p.id));
    }
  };

  const handleConvert = async () => {
    const numAmount = parseFloat(actualAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Укажите сумму, потраченную на покупку');
      return;
    }

    if (!paidById) {
      showToast('Выберите, кто оплатил эту покупку', { type: 'warning' });
      return;
    }

    if (selectedConsumerIds.length === 0) {
      showToast('Выберите участников, кто скидывается', { type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    const expense = await convertShoppingItemToExpense(
      item.id,
      numAmount,
      paidById,
      selectedConsumerIds
    );
    setIsSubmitting(false);

    if (expense) {
      showToast(
        `«${item.title}» (${formatRubles(numAmount)}) добавлено в чек! 🧾`,
        { type: 'success' }
      );
      onClose();
    } else {
      showToast('Не удалось перенести в чек', { type: 'error' });
    }
  };

  const numAmount = parseFloat(actualAmount.replace(',', '.')) || 0;
  const splitCount = selectedConsumerIds.length;
  const perPersonAmount = splitCount > 0 ? numAmount / splitCount : 0;

  return (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={styles.headerBadge}>
            <Ionicons name="receipt" size={14} color={theme.colors.primary} />
            <Text style={styles.headerBadgeText}>ПЕРЕНОС В ЧЕК</Text>
          </View>
          <Text style={styles.headerTitle}>Куплено! Внести в расходы?</Text>
          <Text style={styles.itemTitleBanner}>«{item.title}»</Text>
          <Text style={styles.headerSubtitle}>
            Позиция отметится как купленная, а сумма распределится между участниками в общем чеке.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* Amount Input */}
        <Input
          label="Фактическая стоимость (по чеку) *"
          placeholder="0"
          value={actualAmount}
          onChangeText={(val) => {
            setActualAmount(val);
            if (amountError) setAmountError(undefined);
          }}
          keyboardType="numeric"
          suffix="₽"
          error={amountError}
          helperText={
            item.estimatedAmount
              ? `Примерная цена была: ${formatRubles(item.estimatedAmount)}`
              : 'Введите точную сумму из чека или магазина'
          }
          autoFocus
        />

        {/* Who Paid */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>КТО ОПЛАТИЛ? (ПЛАТЕЛЬЩИК)</Text>
          <View style={styles.payerList}>
            {partyProfiles.map((p) => {
              const isSelected = paidById === p.id;
              const isMe = session?.user.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.payerChip, isSelected && styles.payerChipActive]}
                  onPress={() => setPaidById(p.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.payerAvatar,
                      { backgroundColor: p.avatarColor || getAvatarColor(p.name) },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(p.name)}</Text>
                  </View>
                  <Text
                    style={[styles.payerName, isSelected && styles.payerNameActive]}
                    numberOfLines={1}
                  >
                    {p.name} {isMe ? '(Вы)' : ''}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={theme.colors.primary}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Who Splits */}
        <View style={styles.section}>
          <View style={styles.consumerHeader}>
            <Text style={styles.sectionLabel}>КТО СКИДЫВАЕТСЯ?</Text>
            <TouchableOpacity onPress={handleToggleAll} activeOpacity={0.7}>
              <Text style={styles.selectAllText}>
                {isAllConsumersSelected ? 'Снять всех' : 'Все участники'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.consumerGrid}>
            {partyProfiles.map((p) => {
              const isSelected = selectedConsumerIds.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.consumerCard,
                    isSelected && styles.consumerCardActive,
                  ]}
                  onPress={() => handleToggleConsumer(p.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.consumerAvatar,
                      { backgroundColor: p.avatarColor || getAvatarColor(p.name) },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(p.name)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.consumerName,
                      isSelected && styles.consumerNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Live Calculation Preview */}
        {numAmount > 0 && splitCount > 0 && (
          <View style={styles.calcPreview}>
            <Ionicons name="calculator-outline" size={18} color={theme.colors.info} />
            <Text style={styles.calcPreviewText}>
              По{' '}
              <Text style={styles.calcPreviewHighlight}>
                {formatRubles(perPersonAmount)}
              </Text>{' '}
              с человека ({splitCount} чел.)
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Внести в чек 💳"
            variant="primary"
            size="lg"
            onPress={handleConvert}
            loading={isSubmitting}
            icon="checkmark-done-circle"
          />
          <Button
            title="Отмена"
            variant="ghost"
            size="md"
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    formContainer: {
      width: '100%',
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceBorder,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 28,
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 8,
      backgroundColor: theme.colors.primaryLight,
      gap: 4,
      marginBottom: 6,
    },
    headerBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.colors.primary,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.3,
    },
    itemTitleBanner: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
      marginTop: 4,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 17,
    },
    section: {
      marginTop: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
      marginBottom: 10,
    },
    payerList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    payerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 6,
    },
    payerChipActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    payerAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 9,
      fontWeight: '800',
      color: '#ffffff',
    },
    payerName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    payerNameActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    consumerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 10,
    },
    consumerGrid: {
      gap: 8,
    },
    consumerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      justifyContent: 'space-between',
    },
    consumerCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    consumerAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    consumerName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    consumerNameActive: {
      fontWeight: '700',
      color: theme.colors.primary,
    },
    calcPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 8,
      marginTop: 18,
    },
    calcPreviewText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    calcPreviewHighlight: {
      fontWeight: '800',
      color: theme.colors.primary,
    },
    actions: {
      marginTop: 22,
    },
  });
}
