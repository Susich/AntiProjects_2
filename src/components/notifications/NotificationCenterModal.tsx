import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { useNotificationStore } from '../../store/useNotificationStore';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { AppNotification, NotificationType } from '../../types';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectNotification?: (notification: AppNotification) => void;
}

function formatNotificationTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч. назад`;

  const d = new Date(timestamp);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
  onSelectNotification,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Очистить историю?',
      'Все полученные уведомления будут безвозвратно удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => clearAll(),
        },
      ]
    );
  };

  const getCategoryMeta = (type: NotificationType) => {
    switch (type) {
      case 'party_invite':
        return { icon: 'sparkles' as const, color: theme.colors.neonCyan };
      case 'bill_change':
        return { icon: 'receipt-outline' as const, color: theme.colors.primary };
      case 'payment_status':
        return { icon: 'checkmark-circle' as const, color: theme.colors.success };
      case 'debt_reminder':
        return { icon: 'alarm-outline' as const, color: theme.colors.warning };
      case 'party_closed':
        return { icon: 'archive-outline' as const, color: theme.colors.info };
      default:
        return { icon: 'notifications-outline' as const, color: theme.colors.primary };
    }
  };

  const handleItemPress = (item: AppNotification) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (onSelectNotification) {
      onSelectNotification(item);
      onClose();
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const meta = getCategoryMeta(item.type);
    return (
      <View
        style={[
          styles.itemCard,
          !item.read && styles.itemCardUnread,
        ]}
      >
        <TouchableOpacity
          style={styles.itemMain}
          activeOpacity={0.75}
          onPress={() => handleItemPress(item)}
        >
          <View
            style={[
              styles.itemIconWrap,
              { backgroundColor: `${meta.color}16`, borderColor: `${meta.color}35` },
            ]}
          >
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          </View>

          <View style={styles.itemBody}>
            <View style={styles.itemHeader}>
              <Text
                style={[
                  styles.itemTitle,
                  !item.read && { fontWeight: '700', color: theme.colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.itemTime}>
                {formatNotificationTime(item.timestamp)}
              </Text>
            </View>

            <Text style={styles.itemMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>

          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>

        {/* Delete action button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteNotification(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Удалить уведомление"
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <BottomSheetModal visible={visible} onClose={onClose} height="88%">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.modalTitle}>Уведомления</Text>
                {unreadCount > 0 && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalSubtitle}>История событий и счетов</Text>
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={markAllAsRead}
                  activeOpacity={0.7}
                  accessibilityLabel="Прочитать всё"
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setIsSettingsOpen(true)}
                activeOpacity={0.7}
                accessibilityLabel="Настройки уведомлений"
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* List or Empty State */}
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="notifications-off-outline"
                  size={36}
                  color={theme.colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>Входящих пока нет</Text>
              <Text style={styles.emptySubtitle}>
                Здесь будут появляться оповещения о включении в чек, оплатах друзей и
                напоминаниях.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trash-bin-outline"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.clearAllText}>Очистить всю историю</Text>
                </TouchableOpacity>
              }
            />
          )}
        </View>
      </BottomSheetModal>

      {/* Settings Modal child */}
      <NotificationSettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
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
      paddingTop: 4,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    headerLeft: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    badgePill: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: 10,
    },
    badgeText: {
      color: theme.colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 40,
    },
    listSeparator: {
      height: 8,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    itemCardUnread: {
      borderColor: `${theme.colors.primary}50`,
      backgroundColor: `${theme.colors.primary}08`,
    },
    itemMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 11,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    itemBody: {
      flex: 1,
      marginRight: 8,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    itemTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flex: 1,
      marginRight: 6,
    },
    itemTime: {
      fontSize: 10,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    itemMessage: {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginRight: 6,
    },
    deleteBtn: {
      padding: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 6,
      marginTop: 8,
    },
    clearAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 60,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${theme.colors.surfaceBorder}60`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
  });
}
