import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { ThemeTokens, useTheme } from '../context/ThemeContext';
import { formatPhone, formatRubles } from '../utils/currency';
import { getUserStats } from '../utils/profileStats';
import { Card } from '../components/common/Card';
import { ProfileEditModal } from '../components/profile/ProfileEditModal';
import { ThemeSelectorModal } from '../components/common/ThemeSelectorModal';
import { CloudSyncModal } from '../components/party/CloudSyncModal';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { ShareAppModal } from '../components/common/ShareAppModal';
import { UpdateModal } from '../components/update/UpdateModal';
import { useToast } from '../components/common/Toast';
import { Avatar } from '../components/common/Avatar';
import { BottomSheetModal } from '../components/common/BottomSheetModal';
import {
  pickAvatarFromGallery,
  takeAvatarWithCamera,
} from '../services/avatarService';
import {
  checkForAppUpdate,
  CURRENT_APP_VERSION,
  getCurrentAppVersion,
  UpdateCheckResult,
} from '../services/updateService';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}

export const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const session = usePartyStore((s) => s.session);
  const currentParty = usePartyStore((s) => s.currentParty);
  const history = usePartyStore((s) => s.history);
  const logout = usePartyStore((s) => s.logout);
  const updateAvatar = usePartyStore((s) => s.updateAvatar);
  const { showToast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState(CURRENT_APP_VERSION);

  useEffect(() => {
    void getCurrentAppVersion().then((v) => setAppVersion(v));
  }, []);

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await checkForAppUpdate();
      setAppVersion(res.currentVersion);
      setUpdateInfo(res);
      if (res.hasUpdate) {
        setIsUpdateModalOpen(true);
      } else {
        showToast(`У вас установлена последняя версия (v${res.currentVersion})`, {
          type: 'success',
          icon: 'checkmark-circle',
        });
      }
    } catch {
      showToast('Не удалось проверить наличие обновлений', { type: 'error' });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handlePickFromGallery = async () => {
    setIsAvatarModalOpen(false);
    if (!session) return;
    const res = await pickAvatarFromGallery(session.user.id);
    if (res) {
      void updateAvatar(res.dataUrl);
      showToast('Аватарка обновлена', { type: 'success' });
    }
  };

  const handleTakeWithCamera = async () => {
    setIsAvatarModalOpen(false);
    if (!session) return;
    const res = await takeAvatarWithCamera(session.user.id);
    if (res) {
      void updateAvatar(res.dataUrl);
      showToast('Аватарка обновлена', { type: 'success' });
    }
  };

  const handleRemoveAvatar = () => {
    setIsAvatarModalOpen(false);
    if (session) {
      void updateAvatar(null);
      showToast('Аватарка удалена', { type: 'info' });
    }
  };

  const stats = useMemo(
    () => getUserStats(session?.user || null, currentParty, history),
    [session?.user, currentParty, history]
  );

  if (!session) return null;

  const handleLogout = () => {
    Alert.alert(
      'Выйти из аккаунта?',
      'Локальная комната будет очищена. История и статистика сохранятся на этом устройстве.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const settingsRow = ({
    icon,
    title,
    subtitle,
    onPress,
    danger,
    last,
  }: SettingsRowProps) => (
    <TouchableOpacity
      key={title}
      style={[styles.settingsRow, !last && styles.settingsRowBorder]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.settingsIcon,
          danger && { backgroundColor: `${theme.colors.danger}18` },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? theme.colors.danger : theme.colors.primary}
        />
      </View>
      <View style={styles.settingsText}>
        <Text style={[styles.settingsTitle, danger && { color: theme.colors.danger }]}>
          {title}
        </Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={danger ? theme.colors.danger : theme.colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <Avatar
            url={session.user.avatarUrl}
            name={session.user.name}
            color={session.user.avatarColor}
            size={60}
            showEditBadge
            badgeIcon="camera"
            onPress={() => setIsAvatarModalOpen(true)}
            accessibilityLabel="Изменить фото профиля"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {session.user.name}
            </Text>
            <Text style={styles.phone}>{formatPhone(session.user.phone)}</Text>
            <View style={styles.bankPill}>
              <Ionicons name="business-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.bankText}>{session.user.bank}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Редактировать профиль"
          >
            <Ionicons name="pencil" size={17} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Статистика за всё время</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Ionicons name="wallet-outline" size={18} color={theme.colors.primary} />
            </View>
            <AnimatedNumber
              value={stats.totalSpent}
              formatter={formatRubles}
              style={styles.statValue}
            />
            <Text style={styles.statLabel}>Потрачено на себя</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.colors.info}18` }]}>
              <Ionicons name="receipt-outline" size={18} color={theme.colors.info} />
            </View>
            <Text style={styles.statValue}>{stats.billsPaidCount}</Text>
            <Text style={styles.statLabel}>Оплачено счетов</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${theme.colors.success}18` }]}>
              <Ionicons name="cash-outline" size={18} color={theme.colors.success} />
            </View>
            <AnimatedNumber
              value={stats.totalFronted}
              formatter={formatRubles}
              style={styles.statValue}
            />
            <Text style={styles.statLabel}>Сумма ваших оплат</Text>
          </View>
        </View>

        <Card style={styles.billsCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Оплаченные счета</Text>
            </View>
            <Text style={styles.cardBadge}>{stats.billsPaidCount}</Text>
          </View>

          {stats.paidBills.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={28} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>Пока нет оплаченных счетов</Text>
              <Text style={styles.emptyText}>
                Добавьте трату в комнате и укажите себя плательщиком — она появится здесь.
              </Text>
            </View>
          ) : (
            stats.paidBills.map((bill) => {
              const date = Date.parse(bill.date);
              const dateLabel = Number.isFinite(date)
                ? new Date(date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })
                : '';
              return (
                <View key={`${bill.partyId}_${bill.expense.id}`} style={styles.billRow}>
                  <View style={styles.billIcon}>
                    <Ionicons name="checkmark" size={14} color={theme.colors.success} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billTitle} numberOfLines={1}>
                      {bill.expense.title}
                    </Text>
                    <Text style={styles.billSubtitle} numberOfLines={1}>
                      {bill.partyTitle}
                      {dateLabel ? ` · ${dateLabel}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.billAmount}>{formatRubles(bill.expense.amount)}</Text>
                </View>
              );
            })
          )}
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Настройки</Text>
        </View>

        <Card style={styles.settingsCard}>
          {settingsRow({
            icon: 'color-palette-outline',
            title: 'Тема оформления',
            subtitle: 'Выберите настроение приложения',
            onPress: () => setIsThemeOpen(true),
          })}
          {settingsRow({
            icon: 'cloud-outline',
            title: 'Комната и Google Sheets',
            subtitle: currentParty.code
              ? `Подключено · код ${currentParty.code}`
              : 'Создать или подключить общую комнату',
            onPress: () => setIsCloudOpen(true),
          })}
          {settingsRow({
            icon: 'qr-code-outline',
            title: 'Поделиться приложением',
            subtitle: 'QR-код и ссылка для быстрой установки',
            onPress: () => setIsShareOpen(true),
          })}
          {settingsRow({
            icon: 'cloud-download-outline',
            title: 'Проверить обновления',
            subtitle: isCheckingUpdate
              ? 'Проверка новой версии на Google Диске...'
              : `Версия v${appVersion} · Google Диск`,
            onPress: handleManualCheckUpdate,
          })}
          {settingsRow({
            icon: 'log-out-outline',
            title: 'Выйти из аккаунта',
            subtitle: 'Очистить сессию на этом устройстве',
            onPress: handleLogout,
            danger: true,
            last: true,
          })}
        </Card>

        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={15} color={theme.colors.textMuted} />
          <Text style={styles.footerText}>
            Личный профиль используется во всех комнатах. Банк для конкретного сбора
            подтверждается отдельно при создании или входе.
          </Text>
        </View>
      </ScrollView>

      <ProfileEditModal visible={isEditOpen} onClose={() => setIsEditOpen(false)} />
      <ThemeSelectorModal visible={isThemeOpen} onClose={() => setIsThemeOpen(false)} />
      <CloudSyncModal visible={isCloudOpen} onClose={() => setIsCloudOpen(false)} />
      <ShareAppModal
        visible={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        partyCode={currentParty.code}
        partyTitle={currentParty.title}
      />
      <UpdateModal
        visible={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          void getCurrentAppVersion().then((v) => setAppVersion(v));
        }}
        updateInfo={updateInfo}
        onVersionUpdated={(newVer) => setAppVersion(newVer)}
      />

      {/* Avatar Action Sheet Modal */}
      <BottomSheetModal
        visible={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        height="auto"
        maxHeight="90%"
      >
        {() => (
          <View
            style={[
              styles.avatarModalContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 40 },
            ]}
          >
            <Text style={styles.avatarModalTitle}>Фото профиля</Text>
            <Text style={styles.avatarModalSubtitle}>
              Выберите фото из галереи или сделайте снимок
            </Text>

            <TouchableOpacity
              style={styles.avatarOptionButton}
              onPress={() => void handlePickFromGallery()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Выбрать из галереи"
            >
              <View
                style={[
                  styles.avatarOptionIcon,
                  { backgroundColor: `${theme.colors.primary}18` },
                ]}
              >
                <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.avatarOptionText}>
                <Text style={styles.avatarOptionTitle}>Выбрать из галереи</Text>
                <Text style={styles.avatarOptionDesc}>Загрузить фотографию с телефона</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarOptionButton}
              onPress={() => void handleTakeWithCamera()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Сделать снимок камерой"
            >
              <View
                style={[
                  styles.avatarOptionIcon,
                  { backgroundColor: `${theme.colors.neonCyan}18` },
                ]}
              >
                <Ionicons name="camera-outline" size={20} color={theme.colors.neonCyan} />
              </View>
              <View style={styles.avatarOptionText}>
                <Text style={styles.avatarOptionTitle}>Сделать снимок</Text>
                <Text style={styles.avatarOptionDesc}>Открыть камеру устройства</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {Boolean(session.user.avatarUrl) && (
              <TouchableOpacity
                style={styles.avatarOptionButton}
                onPress={handleRemoveAvatar}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Удалить аватарку"
              >
                <View
                  style={[
                    styles.avatarOptionIcon,
                    { backgroundColor: `${theme.colors.danger}18` },
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                </View>
                <View style={styles.avatarOptionText}>
                  <Text style={[styles.avatarOptionTitle, { color: theme.colors.danger }]}>
                    Удалить аватарку
                  </Text>
                  <Text style={styles.avatarOptionDesc}>Вернуть стандартные инициалы</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.avatarCancelButton}
              onPress={() => setIsAvatarModalOpen(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.avatarCancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetModal>
    </>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 88,
      gap: theme.spacing.md,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.colors.textInverse,
      fontSize: 20,
      fontWeight: '800',
    },
    avatarModalContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    avatarModalTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    avatarModalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginBottom: theme.spacing.xs,
    },
    avatarOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
    },
    avatarOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarOptionText: {
      flex: 1,
      gap: 2,
    },
    avatarOptionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    avatarOptionDesc: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    avatarCancelButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      marginTop: 4,
    },
    avatarCancelButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    profileInfo: {
      flex: 1,
      gap: 2,
    },
    name: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    phone: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    bankPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: `${theme.colors.primary}16`,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 3,
    },
    bankText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    editButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    sectionHeader: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    statValue: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 2,
    },
    billsCard: {
      padding: theme.spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    cardBadge: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '800',
      backgroundColor: `${theme.colors.primary}18`,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 9,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xl,
      gap: 6,
    },
    emptyTitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      maxWidth: 280,
    },
    billRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
    billIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: `${theme.colors.success}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    billInfo: {
      flex: 1,
    },
    billTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    billSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    billAmount: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: '800',
    },
    settingsCard: {
      padding: 0,
      overflow: 'hidden',
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    settingsRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    settingsIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: `${theme.colors.primary}14`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsText: {
      flex: 1,
    },
    settingsTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    settingsSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    footerNote: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    footerText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
  });
}
