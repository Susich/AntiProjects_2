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
import { ItemCategory, ShoppingItem, UserProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { getAvatarColor, getInitials } from '../../utils/currency';
import { useToast } from '../common/Toast';

interface AddShoppingItemModalProps {
  visible: boolean;
  onClose: () => void;
  editItem?: ShoppingItem | null;
  initialPreset?: { title: string; category?: ItemCategory; estimatedAmount?: number } | null;
}

const CATEGORIES: { id: ItemCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'food', label: 'Еда', icon: 'pizza-outline' },
  { id: 'drink', label: 'Напитки', icon: 'beer-outline' },
  { id: 'hookah', label: 'Кальян', icon: 'cloudy-outline' },
  { id: 'other', label: 'Другое', icon: 'receipt-outline' },
];

export const PARTY_PRESETS: {
  title: string;
  category: ItemCategory;
  estimatedAmount?: number;
  emoji: string;
}[] = [
  { emoji: '🥩', title: 'Шашлык / Мясо', category: 'food', estimatedAmount: 2500 },
  { emoji: '🔥', title: 'Угли и розжиг', category: 'other', estimatedAmount: 700 },
  { emoji: '🥤', title: 'Напитки и соки', category: 'drink', estimatedAmount: 1200 },
  { emoji: '🍽️', title: 'Посуда и салфетки', category: 'other', estimatedAmount: 500 },
  { emoji: '🍿', title: 'Снеки и чипсы', category: 'food', estimatedAmount: 800 },
  { emoji: '🥬', title: 'Овощи и зелень', category: 'food', estimatedAmount: 900 },
  { emoji: '💧', title: 'Питьевая вода 5л', category: 'drink', estimatedAmount: 300 },
  { emoji: '💨', title: 'Табак / угли для кальяна', category: 'hookah', estimatedAmount: 1500 },
];

export const AddShoppingItemModal: React.FC<AddShoppingItemModalProps> = ({
  visible,
  onClose,
  editItem,
  initialPreset,
}) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    height="88%"
    maxHeight="92%"
  >
    {({ onScroll }) => (
      <AddShoppingItemForm
        key={editItem?.id ?? initialPreset?.title ?? 'new_shopping_form'}
        onClose={onClose}
        editItem={editItem}
        initialPreset={initialPreset}
        onScroll={onScroll}
      />
    )}
  </BottomSheetModal>
);

interface AddShoppingItemFormProps extends Omit<AddShoppingItemModalProps, 'visible'> {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const AddShoppingItemForm: React.FC<AddShoppingItemFormProps> = ({
  onClose,
  editItem,
  initialPreset,
  onScroll,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);
  const addShoppingItem = usePartyStore((s) => s.addShoppingItem);
  const updateShoppingItem = usePartyStore((s) => s.updateShoppingItem);
  const { showToast } = useToast();

  const partyProfiles: UserProfile[] = useMemo(
    () => currentParty.participants || [],
    [currentParty.participants]
  );

  const [title, setTitle] = useState(
    editItem?.title ?? initialPreset?.title ?? ''
  );
  const [estimatedAmount, setEstimatedAmount] = useState(
    editItem?.estimatedAmount
      ? String(editItem.estimatedAmount)
      : initialPreset?.estimatedAmount
      ? String(initialPreset.estimatedAmount)
      : ''
  );
  const [category, setCategory] = useState<ItemCategory>(
    editItem?.category ?? initialPreset?.category ?? 'food'
  );
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>(
    editItem?.assignedUserId ?? undefined
  );

  const [titleError, setTitleError] = useState<string | undefined>();

  const handleApplyPreset = (preset: (typeof PARTY_PRESETS)[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    if (preset.estimatedAmount) {
      setEstimatedAmount(String(preset.estimatedAmount));
    }
    setTitleError(undefined);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Введите название покупки');
      return;
    }

    const numEstimate = estimatedAmount
      ? parseFloat(estimatedAmount.replace(',', '.'))
      : undefined;

    if (editItem) {
      updateShoppingItem(editItem.id, {
        title: trimmedTitle,
        estimatedAmount: numEstimate && numEstimate > 0 ? numEstimate : undefined,
        category,
        assignedUserId,
      });
      showToast(`Пункт «${trimmedTitle}» обновлён`, { type: 'success' });
    } else {
      addShoppingItem(trimmedTitle, numEstimate, assignedUserId, category);
      showToast(`«${trimmedTitle}» добавлено в список`, { type: 'success' });
    }

    onClose();
  };

  return (
    <View style={styles.formContainer}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.headerTitle}>
            {editItem ? 'Редактировать пункт' : 'Что нужно купить?'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {editItem
              ? 'Измените название, примерную сумму или ответственного'
              : 'Составьте список к тусовке, чтобы распределить покупки'}
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
        {/* Quick Presets (only on new item) */}
        {!editItem && (
          <View style={styles.presetsSection}>
            <Text style={styles.sectionLabel}>БЫСТРЫЕ ШАБЛОНЫ</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsList}
            >
              {PARTY_PRESETS.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetChip,
                    title === preset.title && styles.presetChipActive,
                  ]}
                  onPress={() => handleApplyPreset(preset)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text
                    style={[
                      styles.presetText,
                      title === preset.title && styles.presetTextActive,
                    ]}
                  >
                    {preset.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Title Input */}
        <Input
          label="Название покупки *"
          placeholder="Например: Стейки из свинины 3кг"
          value={title}
          onChangeText={(val) => {
            setTitle(val);
            if (titleError) setTitleError(undefined);
          }}
          error={titleError}
          clearButton
          autoCapitalize="sentences"
        />

        {/* Estimated Amount */}
        <Input
          label="Примерная стоимость (необязательно)"
          placeholder="0"
          value={estimatedAmount}
          onChangeText={setEstimatedAmount}
          keyboardType="numeric"
          suffix="₽"
          helperText="Поможет прикинуть общий бюджет до похода в магазин"
        />

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>КАТЕГОРИЯ</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryBtn, isSelected && styles.categoryBtnActive]}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon}
                    size={16}
                    color={isSelected ? theme.colors.textInverse : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryBtnText,
                      isSelected && styles.categoryBtnTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Assignee Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>КТО КУПИТ? (ОТВЕТСТВЕННЫЙ)</Text>
          <View style={styles.assigneeList}>
            {/* Unassigned Option */}
            <TouchableOpacity
              style={[
                styles.assigneeChip,
                !assignedUserId && styles.assigneeChipActive,
              ]}
              onPress={() => setAssignedUserId(undefined)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.assigneeAvatar,
                  { backgroundColor: theme.colors.surfaceBorder },
                ]}
              >
                <Ionicons
                  name="help-outline"
                  size={14}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.assigneeName,
                  !assignedUserId && styles.assigneeNameActive,
                ]}
              >
                Кто-нибудь
              </Text>
            </TouchableOpacity>

            {/* Participants */}
            {partyProfiles.map((p) => {
              const isSelected = assignedUserId === p.id;
              const isMe = session?.user.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.assigneeChip,
                    isSelected && styles.assigneeChipActive,
                  ]}
                  onPress={() => setAssignedUserId(p.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.assigneeAvatar,
                      { backgroundColor: p.avatarColor || getAvatarColor(p.name) },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(p.name)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.assigneeName,
                      isSelected && styles.assigneeNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {p.name} {isMe ? '(Вы)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={editItem ? 'Сохранить изменения' : 'Добавить в список'}
            variant="primary"
            size="lg"
            onPress={handleSave}
            icon={editItem ? 'checkmark-circle' : 'add-circle'}
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
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    presetsSection: {
      marginBottom: 16,
    },
    presetsList: {
      paddingVertical: 4,
      gap: 8,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    presetChipActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    presetEmoji: {
      fontSize: 14,
      marginRight: 6,
    },
    presetText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    presetTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
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
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 6,
    },
    categoryBtnActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    categoryBtnTextActive: {
      color: theme.colors.textInverse,
      fontWeight: '700',
    },
    assigneeList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    assigneeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      gap: 6,
      maxWidth: '48%',
    },
    assigneeChipActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    assigneeAvatar: {
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
    assigneeName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },
    assigneeNameActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    actions: {
      marginTop: 24,
    },
  });
}
