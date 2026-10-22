import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useToast } from '../common/Toast';
import { NotificationType } from '../../types';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();

  const preferences = useNotificationStore((s) => s.preferences);
  const updatePreferences = useNotificationStore((s) => s.updatePreferences);
  const dispatchNotification = useNotificationStore((s) => s.dispatchNotification);

  const handleMasterToggle = (val: boolean) => {
    updatePreferences({ enabled: val });
  };

  const handleChannelToggle = (channel: 'inApp', val: boolean) => {
    updatePreferences({
      channels: {
        ...preferences.channels,
        [channel]: val,
      },
    });
  };

  const handleCategoryToggle = (category: NotificationType, val: boolean) => {
    updatePreferences({
      categories: {
        ...preferences.categories,
        [category]: val,
      },
    });
  };

  const handleSendTest = async () => {
    await dispatchNotification('party_invite', {
      partyTitle: 'Бар «Руки Вверх»',
      amount: 1450,
      actorName: 'Саня',
      forceInApp: true,
    });
    showToast('Тестовое уведомление отправлено!', { type: 'info' });
  };

  const categoriesConfig: {
    key: NotificationType;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    color: string;
  }[] = [
    {
      key: 'party_invite',
      icon: 'sparkles',
      title: 'Новые сборы и счета',
      description: 'Когда вас добавляют в тусу или распределяют позиции',
      color: theme.colors.neonCyan,
    },
    {
      key: 'bill_change',
      icon: 'receipt-outline',
      title: 'Изменения в чеках',
      description: 'Правки сумм, добавление или удаление ваших товаров',
      color: theme.colors.primary,
    },
    {
      key: 'payment_status',
      icon: 'checkmark-circle-outline',
      title: 'Оплаты участников',
      description: 'Когда кто-то из друзей отмечает перевод своей доли',
      color: theme.colors.success,
    },
    {
      key: 'debt_reminder',
      icon: 'alarm-outline',
      title: 'Напоминания об оплате',
      description: 'Пинги и напоминания по ожидающим счетам',
      color: theme.colors.warning,
    },
    {
      key: 'party_closed',
      icon: 'archive-outline',
      title: 'Завершение и архивация',
      description: 'Когда все доли оплачены и туса переведена в архив',
      color: theme.colors.info,
    },
  ];

  return (
    <BottomSheetModal visible={visible} onClose={onClose} height="88%">
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="notifications"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.modalTitle}>Центр уведомлений</Text>
              <Text style={styles.modalSubtitle}>
                Уведомления и события в приложении
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Master Toggle */}
          <Card style={styles.masterCard}>
            <View style={styles.masterRow}>
              <View style={styles.masterTextWrap}>
                <View style={styles.badgeRow}>
                  <Text style={styles.masterTitle}>Разрешить все уведомления</Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: preferences.enabled
                          ? `${theme.colors.success}18`
                          : `${theme.colors.danger}18`,
                        borderColor: preferences.enabled
                          ? `${theme.colors.success}40`
                          : `${theme.colors.danger}40`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: preferences.enabled
                            ? theme.colors.success
                            : theme.colors.danger,
                        },
                      ]}
                    >
                      {preferences.enabled ? 'Включено' : 'Выключено'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.masterDesc}>
                  Включение и выключение всех всплывающих уведомлений в приложении
                </Text>
              </View>
              <Switch
                value={preferences.enabled}
                onValueChange={handleMasterToggle}
                trackColor={{
                  false: theme.colors.surfaceBorder,
                  true: theme.colors.primary,
                }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              />
            </View>
          </Card>

          {/* Delivery Channels */}
          <Text style={styles.sectionHeading}>Отображение</Text>
          <Card style={styles.sectionCard}>
            {/* In-App Toasts Channel */}
            <View style={styles.itemRow}>
              <View style={[styles.itemIcon, { backgroundColor: `${theme.colors.neonCyan}18` }]}>
                <Ionicons
                  name="notifications-outline"
                  size={19}
                  color={theme.colors.neonCyan}
                />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>Всплывающие плашки (In-App)</Text>
                <Text style={styles.itemDesc}>
                  Интерактивные карточки со свайпом при работе в приложении
                </Text>
              </View>
              <Switch
                disabled={!preferences.enabled}
                value={preferences.channels.inApp}
                onValueChange={(val) => handleChannelToggle('inApp', val)}
                trackColor={{
                  false: theme.colors.surfaceBorder,
                  true: theme.colors.primary,
                }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              />
            </View>
          </Card>

          {/* Event Categories */}
          <Text style={styles.sectionHeading}>Категории событий</Text>
          <Card style={styles.sectionCard}>
            {categoriesConfig.map((cat, index) => {
              const isLast = index === categoriesConfig.length - 1;
              const isEnabled = preferences.categories[cat.key];
              return (
                <React.Fragment key={cat.key}>
                  <View style={styles.itemRow}>
                    <View
                      style={[
                        styles.itemIcon,
                        {
                          backgroundColor: `${cat.color}18`,
                          borderColor: `${cat.color}30`,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Ionicons name={cat.icon} size={18} color={cat.color} />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemTitle}>{cat.title}</Text>
                      <Text style={styles.itemDesc}>{cat.description}</Text>
                    </View>
                    <Switch
                      disabled={!preferences.enabled}
                      value={isEnabled}
                      onValueChange={(val) => handleCategoryToggle(cat.key, val)}
                      trackColor={{
                        false: theme.colors.surfaceBorder,
                        true: theme.colors.primary,
                      }}
                      thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                    />
                  </View>
                  {!isLast && <View style={styles.separator} />}
                </React.Fragment>
              );
            })}
          </Card>

          {/* Test Action */}
          <View style={styles.testSection}>
            <Button
              title="Отправить тестовое уведомление"
              variant="secondary"
              icon="paper-plane-outline"
              size="md"
              onPress={handleSendTest}
              style={styles.testButton}
              textStyle={styles.testButtonText}
            />
          </View>
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 2,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}35`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTextWrap: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${theme.colors.surfaceBorder}60`,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 40,
    },
    masterCard: {
      marginBottom: 18,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      borderWidth: 1,
      borderRadius: 18,
    },
    masterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    masterTextWrap: {
      flex: 1,
      marginRight: 14,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    masterTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    masterDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: theme.colors.textMuted,
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionCard: {
      marginBottom: 20,
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      borderWidth: 1,
      borderRadius: 18,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    itemIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemTextWrap: {
      flex: 1,
      marginRight: 10,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    itemDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    separator: {
      height: 1,
      backgroundColor: `${theme.colors.surfaceBorder}60`,
      marginLeft: 50,
    },
    testSection: {
      marginTop: 8,
      marginBottom: 16,
    },
    testButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}55`,
      borderRadius: 14,
    },
    testButtonText: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });
}
