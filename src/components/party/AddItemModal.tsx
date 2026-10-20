import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ExpenseItem, ItemCategory, ParticipantProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { formatPhone, formatRubles, getInitials } from '../../utils/currency';
import { addExpenseToCloud } from '../../api/googleSheets';
import { useToast } from '../common/Toast';

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  editItem?: ExpenseItem | null;
}

const CATEGORIES: { id: ItemCategory; label: string; icon: string }[] = [
  { id: 'food', label: 'Еда', icon: 'pizza-outline' },
  { id: 'drink', label: 'Напитки', icon: 'beer-outline' },
  { id: 'hookah', label: 'Кальян', icon: 'cloudy-outline' },
  { id: 'delivery', label: 'Доставка', icon: 'car-outline' },
  { id: 'other', label: 'Другое', icon: 'receipt-outline' },
];

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  onClose,
  editItem,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? <AddItemForm onClose={onClose} editItem={editItem} /> : null}
  </Modal>
);

const AddItemForm: React.FC<Omit<AddItemModalProps, 'visible'>> = ({
  onClose,
  editItem,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const currentParty = usePartyStore((s) => s.currentParty);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const addExpense = usePartyStore((s) => s.addExpense);
  const updateExpense = usePartyStore((s) => s.updateExpense);
  const { showToast } = useToast();

  // Resolve active participants for current party
  const partyProfiles = currentParty.participants
    .map((id) => savedProfiles.find((p) => p.id === id))
    .filter(Boolean) as ParticipantProfile[];

  // Mounted only while the modal is open, so these initializers give us a
  // fresh form on every open without a setState-in-effect round trip.
  const [title, setTitle] = useState(editItem?.title ?? '');
  const [amount, setAmount] = useState(
    editItem ? editItem.amount.toString() : ''
  );
  const [category, setCategory] = useState<ItemCategory>(
    editItem?.category || 'food'
  );
  const [paidById, setPaidById] = useState<string>(
    editItem?.paidById || partyProfiles[0]?.id || ''
  );
  const [selectedConsumerIds, setSelectedConsumerIds] = useState<string[]>(
    editItem
      ? editItem.splitBetween.map((s) => s.userId)
      : partyProfiles.map((p) => p.id)
  );

  const [errors, setErrors] = useState<{
    title?: string;
    amount?: string;
    paidBy?: string;
    consumers?: string;
  }>({});

  // Toggle single consumer
  const handleToggleConsumer = (id: string) => {
    setSelectedConsumerIds((prev) =>
      prev.includes(id) ? prev.filter((userId) => userId !== id) : [...prev, id]
    );
    if (errors.consumers) {
      setErrors((prev) => ({ ...prev, consumers: undefined }));
    }
  };

  // "Скинулись все" toggle button
  const isAllSelected =
    partyProfiles.length > 0 && selectedConsumerIds.length === partyProfiles.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedConsumerIds([]);
    } else {
      setSelectedConsumerIds(partyProfiles.map((p) => p.id));
    }
    if (errors.consumers) {
      setErrors((prev) => ({ ...prev, consumers: undefined }));
    }
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const numAmount = parseFloat(amount.replace(',', '.'));

    const newErrors: typeof errors = {};
    if (!trimmedTitle) {
      newErrors.title = 'Введите название позиции чека';
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = 'Введите корректную сумму больше нуля';
    }
    if (!paidById) {
      newErrors.paidBy = 'Выберите, кто оплатил эту позицию';
    }
    if (selectedConsumerIds.length === 0) {
      newErrors.consumers = 'Выберите хотя бы одного участника, кто гулял';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editItem) {
      updateExpense(editItem.id, {
        title: trimmedTitle,
        amount: numAmount,
        category,
        paidById,
        splitBetween: selectedConsumerIds.map((userId) => ({ userId })),
      });
      showToast(
        currentParty.code
          ? 'Позиция обновлена и синхронизирована с Google Sheets'
          : 'Позиция обновлена'
      );
    } else {
      const created = addExpense(
        trimmedTitle,
        numAmount,
        paidById,
        selectedConsumerIds,
        category
      );
      if (currentParty.code && created) {
        addExpenseToCloud(currentParty.id, {
          // Reuse the local id so every device edits the same sheet row.
          id: created.id,
          title: trimmedTitle,
          amount: numAmount,
          paidById,
          sharedUserIds: selectedConsumerIds,
          category,
        })
          .then((res) => {
            if (res.success) {
              showToast(`«${trimmedTitle}» отправлено в Google Sheets!`, {
                type: 'success',
              });
            }
          })
          .catch((err) => console.warn('[Cloud] Auto-sync expense error:', err));
      } else {
        showToast(`«${trimmedTitle}» добавлено в чек!`);
      }
    }

    onClose();
  };

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const costPerPerson =
    selectedConsumerIds.length > 0 && parsedAmount > 0
      ? Math.round((parsedAmount / selectedConsumerIds.length) * 100) / 100
      : 0;

  const selectedPayer = partyProfiles.find((p) => p.id === paidById);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}
    >
      <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>
                {editItem ? 'Редактировать расход' : 'Новый расход в чеке'}
              </Text>
              <Text style={styles.sheetSubtitle}>
                Укажите, кто оплатил счёт и кто в нём участвовал
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Категория</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={15}
                      color={isSelected ? theme.colors.textInverse : theme.colors.textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        isSelected && styles.categoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Title & Amount */}
            <Input
              label="Название чека / блюда *"
              placeholder="Например: Сет роллов, Счёт в баре, Такси..."
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              error={errors.title}
              leftIcon="receipt-outline"
            />

            <Input
              label="Сумма расхода (₽) *"
              placeholder="2500"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              error={errors.amount}
              leftIcon="cash-outline"
              suffix="₽"
            />

            {/* Requirement 1: "Кто оплатил" Selector */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Кто оплатил из своего кармана? *</Text>
                {selectedPayer && (
                  <Text style={styles.payerSubText}>
                    Платит:{' '}
                    <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
                      {selectedPayer.name}
                    </Text>
                    {selectedPayer.paymentInfo.phone
                      ? ` · ${formatPhone(selectedPayer.paymentInfo.phone)}`
                      : ''}
                  </Text>
                )}
              </View>
            </View>

            {errors.paidBy && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={theme.colors.neonPink}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.errorBannerText}>{errors.paidBy}</Text>
              </View>
            )}

            {partyProfiles.length === 0 ? (
              <View style={styles.noParticipantsNotice}>
                <Ionicons name="warning-outline" size={20} color={theme.colors.warning} />
                <Text style={styles.noParticipantsText}>
                  Добавьте участников в тусовку, чтобы выбрать плательщика!
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.payersScrollRow}
              >
                {partyProfiles.map((p) => {
                  const isSelected = paidById === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        setPaidById(p.id);
                        if (errors.paidBy)
                          setErrors((prev) => ({ ...prev, paidBy: undefined }));
                      }}
                      activeOpacity={0.8}
                      style={[styles.payerCard, isSelected && styles.payerCardActive]}
                    >
                      <View
                        style={[
                          styles.payerAvatar,
                          { backgroundColor: p.avatarColor || theme.colors.primary },
                        ]}
                      >
                        <Text style={styles.payerAvatarText}>{getInitials(p.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.payerName, isSelected && styles.payerNameActive]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={[
                            styles.payerPhone,
                            {
                              color: p.paymentInfo.phone
                                ? theme.colors.textMuted
                                : theme.colors.warning,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {p.paymentInfo.phone
                            ? formatPhone(p.paymentInfo.phone)
                            : 'СБП не указан'}
                        </Text>
                      </View>

                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={theme.colors.primary}
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Requirement 2: "Кто участвовал" Selector */}
            <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Кто участвовал (гулял)? *</Text>
                {selectedConsumerIds.length > 0 && costPerPerson > 0 && (
                  <Text style={styles.splitHint}>
                    По {formatRubles(costPerPerson)} на каждого (
                    {selectedConsumerIds.length} чел.)
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleToggleAll}
                style={[styles.toggleAllBtn, isAllSelected && styles.toggleAllBtnActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isAllSelected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={isAllSelected ? theme.colors.textInverse : theme.colors.info}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.toggleAllText,
                    isAllSelected && styles.toggleAllTextActive,
                  ]}
                >
                  {isAllSelected ? 'Все выбраны' : 'Скинулись все'}
                </Text>
              </TouchableOpacity>
            </View>

            {errors.consumers && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={theme.colors.neonPink}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.errorBannerText}>{errors.consumers}</Text>
              </View>
            )}

            {partyProfiles.length > 0 && (
              <View style={styles.consumersGrid}>
                {partyProfiles.map((p) => {
                  const isChecked = selectedConsumerIds.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => handleToggleConsumer(p.id)}
                      activeOpacity={0.75}
                      style={[
                        styles.consumerCheckCard,
                        isChecked && styles.consumerCheckCardActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.smallAvatar,
                          { backgroundColor: p.avatarColor || theme.colors.info },
                        ]}
                      >
                        <Text style={styles.smallAvatarText}>{getInitials(p.name)}</Text>
                      </View>

                      <Text
                        style={[
                          styles.checkCardName,
                          isChecked && styles.checkCardNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>

                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? theme.colors.primary : theme.colors.textMuted}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.sheetActions}>
            <Button
              title="Отмена"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={{ flex: 1, marginRight: 10 }}
            />
            <Button
              title={editItem ? 'Сохранить изменения' : 'Добавить расход'}
              variant="primary"
              size="md"
              icon="add-circle"
              onPress={handleSave}
              style={{ flex: 1.8 }}
            />
          </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorderActive,
      ...theme.shadows.card,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    categoryRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    categoryPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    categoryTextActive: {
      color: theme.colors.textInverse,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      marginTop: 4,
      gap: 8,
    },
    payerSubText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: -4,
      marginBottom: 8,
    },
    payersScrollRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
      paddingVertical: 2,
    },
    payerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      minWidth: 130,
    },
    payerCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}1A`,
    },
    payerAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    payerAvatarText: {
      color: theme.colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    payerName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    payerNameActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    payerPhone: {
      fontSize: 10,
      fontWeight: '600',
    },
    splitHint: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
      marginTop: -4,
    },
    toggleAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.info}1A`,
      borderWidth: 1,
      borderColor: `${theme.colors.info}4D`,
    },
    toggleAllBtnActive: {
      backgroundColor: theme.colors.info,
      borderColor: theme.colors.info,
    },
    toggleAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.info,
    },
    toggleAllTextActive: {
      color: theme.colors.textInverse,
    },
    consumersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    consumerCheckCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 8,
      paddingHorizontal: 10,
      minWidth: '47%',
      flex: 1,
    },
    consumerCheckCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}14`,
    },
    smallAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    smallAvatarText: {
      color: theme.colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
    },
    checkCardName: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    checkCardNameActive: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.colors.danger}1F`,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.sm,
      marginBottom: 10,
    },
    errorBannerText: {
      color: theme.colors.neonPink,
      fontSize: 12,
      fontWeight: '500',
      flex: 1,
    },
    noParticipantsNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.colors.warning}1F`,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      marginBottom: 16,
    },
    noParticipantsText: {
      color: theme.colors.warning,
      fontSize: 13,
      marginLeft: 8,
      flex: 1,
    },
    sheetActions: {
      flexDirection: 'row',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
  });
