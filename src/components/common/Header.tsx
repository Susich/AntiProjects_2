import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../../store/usePartyStore';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { Input } from './Input';
import { Button } from './Button';
import { useToast } from './Toast';
import { CloudSyncModal } from '../party/CloudSyncModal';
import { NotificationCenterModal } from '../notifications/NotificationCenterModal';
import { RoomQrModal } from '../party/RoomQrModal';
import { useNotificationStore } from '../../store/useNotificationStore';

export const Header: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentParty = usePartyStore((s) => s.currentParty);
  const setPartyTitle = usePartyStore((s) => s.setPartyTitle);
  const resetParty = usePartyStore((s) => s.resetParty);
  const saveCurrentPartyToHistory = usePartyStore((s) => s.saveCurrentPartyToHistory);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { showToast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [tempTitle, setTempTitle] = useState(currentParty.title);

  const handleOpenEdit = () => {
    setTempTitle(currentParty.title);
    setIsEditModalOpen(true);
  };

  const handleSaveTitle = () => {
    const trimmed = tempTitle.trim();
    if (trimmed) {
      setPartyTitle(trimmed);
      showToast('Название сохранено');
    }
    setIsEditModalOpen(false);
  };

  const handlePromptReset = () => {
    Alert.alert(
      'Новая тусовка?',
      'Вы уверены, что хотите начать новый чек? Текущие позиции и участники будут сброшены (вы можете предварительно сохранить их в Историю).',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить и очистить',
          onPress: () => {
            saveCurrentPartyToHistory();
            resetParty();
            showToast('Чек сохранён в Историю и очищен');
          },
        },
        {
          text: 'Очистить без сохранения',
          style: 'destructive',
          onPress: () => {
            resetParty();
            showToast('Чек очищен', { type: 'info' });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoPill}>
            <Ionicons name="wine-outline" size={17} color={theme.colors.textInverse} />
          </View>
          <View>
            <Text style={styles.brandTitle}>
              PartySplit
            </Text>
            <Text style={styles.brandSubtitle}>
              Делим счёт честно
            </Text>
          </View>
        </View>

        {/* Header Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Notifications Bell Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsNotificationsOpen(true)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Уведомления"
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={18}
              color={
                unreadCount > 0 ? theme.colors.primary : theme.colors.textSecondary
              }
            />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cloud Sync Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsCloudModalOpen(true)}
            style={[
              styles.iconBtn,
              currentParty.code ? styles.iconBtnConnected : null,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Синхронизация комнаты"
          >
            <Ionicons
              name={currentParty.code ? 'cloud-done-outline' : 'cloud-outline'}
              size={18}
              color={
                currentParty.code
                  ? theme.colors.neonCyan
                  : theme.colors.textSecondary
              }
            />
            {currentParty.code && (
              <View style={styles.activeCloudDot} />
            )}
          </TouchableOpacity>

          {/* Reset Party Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handlePromptReset}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Новая тусовка"
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Party Name Banner & Cloud Room Badge */}
      <View style={styles.bannerRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenEdit}
          style={styles.partyNameBanner}
        >
          <View style={styles.partyNameLeft}>
            <Ionicons
              name="sparkles"
              size={14}
              color={theme.colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.partyNameText} numberOfLines={1}>
              {currentParty.title || 'Нажмите, чтобы задать название'}
            </Text>
          </View>
          <Ionicons
            name="pencil"
            size={13}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Room Code Badge & QR Trigger */}
        {currentParty.code && (
          <View style={styles.roomBadgeContainer}>
            <TouchableOpacity
              onPress={() => setIsCloudModalOpen(true)}
              style={styles.roomCodeBadge}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people-outline"
                size={13}
                color={theme.colors.neonCyan}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.roomCodeText}>
                {currentParty.code}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsQrModalOpen(true)}
              style={styles.headerQrBtn}
              activeOpacity={0.8}
              accessibilityLabel="Показать QR-код"
            >
              <Ionicons name="qr-code-outline" size={14} color={theme.colors.neonCyan} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Edit Party Title Modal - Positioned in the upper-third of the screen so keyboard never covers it */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.renameOverlay}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsEditModalOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View style={styles.renameCard}>
            <View style={styles.renameCardHeader}>
              <View style={styles.renameIconCircle}>
                <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Название тусовки</Text>
                <Text style={styles.modalSubtitle}>
                  Отображается в сообщениях должникам и чеках
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Input
              value={tempTitle}
              onChangeText={setTempTitle}
              placeholder="Например: Бар «Руки Вверх», ДР Сани..."
              autoFocus
              clearButton
              onSubmitEditing={handleSaveTitle}
              returnKeyType="done"
            />

            <View style={styles.modalActions}>
              <Button
                title="Отмена"
                variant="secondary"
                size="md"
                onPress={() => setIsEditModalOpen(false)}
                style={{ flex: 1, marginRight: 10 }}
              />
              <Button
                title="Сохранить"
                variant="primary"
                size="md"
                onPress={handleSaveTitle}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Room QR Modal */}
      <RoomQrModal
        visible={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        partyCode={currentParty.code || ''}
        partyTitle={currentParty.title}
        partyId={currentParty.id}
      />
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    headerContainer: {
      backgroundColor: theme.colors.background,
      paddingTop: Platform.OS === 'web' ? 16 : 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoPill: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 9,
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    brandSubtitle: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: -1,
      color: theme.colors.primaryLight,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      borderWidth: 1,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    iconBtnConnected: {
      borderColor: theme.colors.neonCyan,
    },
    activeCloudDot: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.neonCyan,
    },
    unreadBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: theme.colors.background,
    },
    unreadBadgeText: {
      color: theme.colors.textInverse,
      fontSize: 9,
      fontWeight: '800',
    },
    bannerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    partyNameBanner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    partyNameLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    partyNameText: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      color: theme.colors.textPrimary,
    },
    roomBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    roomCodeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: `${theme.colors.neonCyan}18`,
      borderColor: theme.colors.neonCyan,
    },
    headerQrBtn: {
      backgroundColor: `${theme.colors.neonCyan}18`,
      borderWidth: 1,
      borderColor: theme.colors.neonCyan,
      borderRadius: 12,
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roomCodeText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: theme.colors.neonCyan,
    },
    renameOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-start',
      paddingTop: Platform.OS === 'android' ? 88 : 100,
      paddingHorizontal: 20,
    },
    renameCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceBorderActive,
      padding: 20,
      ...theme.shadows.card,
    },
    renameCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    renameIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: `${theme.colors.primary}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      padding: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      marginTop: 2,
      color: theme.colors.textSecondary,
    },
    modalActions: {
      flexDirection: 'row',
      marginTop: 14,
    },
  });
}
