import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { SimplifiedDebtTransfer } from '../../types';
import { cleanPhone, formatPhone, formatRubles, getInitials } from '../../utils/currency';
import { copyToClipboard } from '../../utils/clipboard';
import { shareSingleTransfer } from '../../utils/shareText';
import { useToast } from '../common/Toast';
import { PressableScale } from '../common/PressableScale';
import { useNotificationStore } from '../../store/useNotificationStore';
import { usePartyStore } from '../../store/usePartyStore';
import { isOperationPendingForTransfer } from '../../api/cloudQueue';
import { triggerImpact, triggerSuccessHaptic } from '../../utils/haptics';

interface DebtorCardProps {
  transfer: SimplifiedDebtTransfer;
  partyTitle: string;
  onToggleSettled: (transfer: SimplifiedDebtTransfer) => void;
  isUpdating?: boolean;
}

export const DebtorCard: React.FC<DebtorCardProps> = ({
  transfer,
  partyTitle,
  onToggleSettled,
  isUpdating = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [badgeScale] = useState(() => new Animated.Value(1));
  const [checkmarkAnim] = useState(() => new Animated.Value(1));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [confettiAnim] = useState(() => new Animated.Value(0));
  const isFirstRender = useRef(true);

  const isSettled = Boolean(transfer.isSettled);
  const currentPartyId = usePartyStore((s) => s.currentParty.id);
  const isPendingSync = isOperationPendingForTransfer(currentPartyId, transfer.id) || isUpdating;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isSettled) {
      void triggerSuccessHaptic();
    }
    Animated.parallel([
      Animated.sequence([
        Animated.spring(badgeScale, {
          toValue: 1.25,
          speed: 35,
          bounciness: 12,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          speed: 30,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(checkmarkAnim, {
          toValue: 1.35,
          speed: 40,
          bounciness: 14,
          useNativeDriver: true,
        }),
        Animated.spring(checkmarkAnim, {
          toValue: 1,
          speed: 30,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isSettled, badgeScale, checkmarkAnim]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const handleCopyPhone = async () => {
    const phone = cleanPhone(transfer.toUser.phone);
    if (!phone) {
      showToast('Получатель не указал телефон', { type: 'warning' });
      return;
    }

    const ok = await copyToClipboard(`+${phone}`);
    if (!ok) {
      showToast('Не удалось скопировать номер', { type: 'error' });
      return;
    }

    void triggerImpact();
    setCopied(true);

    // Pulse animation
    Animated.sequence([
      Animated.spring(pulseAnim, {
        toValue: 1.08,
        speed: 45,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        speed: 35,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating confetti sparkles
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
    }).start();

    showToast('Номер телефона скопирован! ✨', {
      type: 'success',
      icon: 'checkmark-circle',
    });

    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const ok = await shareSingleTransfer(transfer, partyTitle);
    if (!ok) {
      showToast('Не удалось открыть меню «Поделиться»', { type: 'info' });
    }
  };

  const handleSendReminder = async () => {
    await useNotificationStore.getState().dispatchNotification('debt_reminder', {
      partyTitle,
      amount: transfer.amount,
      actorName: transfer.toUser.name,
    });
    showToast(`Напоминание для ${transfer.fromUser.name} отправлено!`, { type: 'success' });
  };

  const phone = transfer.toUser.phone ? formatPhone(transfer.toUser.phone) : '';

  return (
    <View style={[styles.card, isSettled && styles.cardSettled]}>
      <View style={styles.topRow}>
        <View style={styles.peopleRow}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor:
                  transfer.fromUser.avatarColor || theme.colors.secondary,
              },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(transfer.fromUser.name)}</Text>
          </View>
          <View style={styles.peopleInfo}>
            <Text style={styles.peopleNames} numberOfLines={1}>
              {transfer.fromUser.name} <Text style={styles.arrow}>→</Text>{' '}
              {transfer.toUser.name}
            </Text>
            <Text style={styles.transferHint}>
              {isSettled ? 'Перевод отмечен как выполненный' : 'Ожидает перевода'}
            </Text>
          </View>
        </View>
        <View style={styles.amountBlock}>
          <Text style={[styles.amount, isSettled && styles.amountSettled]}>
            {formatRubles(transfer.amount)}
          </Text>
          <View style={styles.statusPillsRow}>
            {isPendingSync && (
              <View style={styles.syncPendingBadge}>
                <Ionicons name="time-outline" size={11} color={theme.colors.neonCyan} />
                <Text style={styles.syncPendingText}>В очереди</Text>
              </View>
            )}
            <Animated.View
              style={[
                styles.statusPill,
                isSettled && styles.statusPillPaid,
                { transform: [{ scale: badgeScale }] },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: checkmarkAnim }] }}>
                <Ionicons
                  name={isSettled ? 'checkmark-circle' : 'time-outline'}
                  size={12}
                  color={isSettled ? theme.colors.success : theme.colors.warning}
                />
              </Animated.View>
              <Text
                style={[
                  styles.statusText,
                  { color: isSettled ? theme.colors.success : theme.colors.warning },
                ]}
              >
                {isSettled ? 'Оплачено' : 'Ожидает'}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={styles.requisitesBox}>
        <View style={styles.requisiteRow}>
          <View style={styles.requisiteIcon}>
            <Ionicons name="business-outline" size={16} color={theme.colors.primary} />
          </View>
          <View style={styles.requisiteInfo}>
            <Text style={styles.requisiteLabel}>Банк получателя</Text>
            <Text style={styles.requisiteValue}>{transfer.toUser.bank || 'Не указан'}</Text>
          </View>
        </View>

        <View style={styles.requisitesDivider} />

        <View style={styles.requisiteRow}>
          <View style={styles.requisiteIcon}>
            <Ionicons name="call-outline" size={16} color={theme.colors.info} />
          </View>
          <View style={styles.requisiteInfo}>
            <Text style={styles.requisiteLabel}>Телефон для перевода</Text>
            <Text style={[styles.requisiteValue, !phone && styles.requisiteValueMissing]}>
              {phone || 'Получатель не указал номер'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: pulseAnim }] }]}>
          <PressableScale
            style={[styles.copyButton, copied && styles.copyButtonDone]}
            onPress={handleCopyPhone}
            disabled={!phone}
            accessibilityRole="button"
            accessibilityLabel="Скопировать номер телефона получателя"
          >
            {copied && (
              <View style={styles.confettiContainer} pointerEvents="none">
                <Animated.Text
                  style={[
                    styles.confettiParticle,
                    {
                      left: 10,
                      opacity: confettiAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [1, 0.8, 0],
                      }),
                      transform: [
                        {
                          translateY: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -28],
                          }),
                        },
                        {
                          translateX: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -10],
                          }),
                        },
                        {
                          scale: confettiAnim.interpolate({
                            inputRange: [0, 0.3, 1],
                            outputRange: [0.6, 1.2, 0.8],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  ✨
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.confettiParticle,
                    {
                      left: '46%',
                      opacity: confettiAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [1, 0.8, 0],
                      }),
                      transform: [
                        {
                          translateY: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -36],
                          }),
                        },
                        {
                          scale: confettiAnim.interpolate({
                            inputRange: [0, 0.3, 1],
                            outputRange: [0.6, 1.3, 0.7],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  🎉
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.confettiParticle,
                    {
                      right: 12,
                      opacity: confettiAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [1, 0.8, 0],
                      }),
                      transform: [
                        {
                          translateY: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -26],
                          }),
                        },
                        {
                          translateX: confettiAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 8],
                          }),
                        },
                        {
                          scale: confettiAnim.interpolate({
                            inputRange: [0, 0.3, 1],
                            outputRange: [0.6, 1.1, 0.8],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  ⭐
                </Animated.Text>
              </View>
            )}

            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? theme.colors.success : theme.colors.primary}
            />
            <Text
              style={[
                styles.copyText,
                copied && { color: theme.colors.success },
                !phone && { color: theme.colors.textMuted },
              ]}
            >
              {copied ? 'Скопировано!' : 'Скопировать номер'}
            </Text>
          </PressableScale>
        </Animated.View>

        {!isSettled && (
          <PressableScale
            style={styles.remindButton}
            onPress={handleSendReminder}
            accessibilityRole="button"
            accessibilityLabel="Отправить напоминание об оплате"
          >
            <Ionicons name="alarm-outline" size={16} color={theme.colors.warning} />
            <Text style={styles.remindText}>Напомнить</Text>
          </PressableScale>
        )}

        <PressableScale
          style={styles.shareButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Поделиться переводом"
        >
          <Ionicons name="share-social-outline" size={19} color={theme.colors.textSecondary} />
        </PressableScale>
      </View>

      <PressableScale
        style={[styles.settleButton, isSettled && styles.settleButtonUndo]}
        onPress={() => onToggleSettled(transfer)}
        disabled={isUpdating}
        haptic
        accessibilityRole="button"
      >
        <Ionicons
          name={isSettled ? 'refresh-outline' : 'checkmark-done-outline'}
          size={17}
          color={isSettled ? theme.colors.textSecondary : theme.colors.textInverse}
        />
        <Text
          style={[
            styles.settleText,
            isSettled && { color: theme.colors.textSecondary },
          ]}
        >
          {isSettled ? 'Вернуть в ожидание' : 'Отметить оплаченным'}
        </Text>
      </PressableScale>
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    cardSettled: {
      borderColor: `${theme.colors.success}55`,
      backgroundColor: `${theme.colors.success}08`,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    peopleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      flex: 1,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    peopleInfo: {
      flex: 1,
    },
    peopleNames: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    arrow: {
      color: theme.colors.textMuted,
    },
    transferHint: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    amountBlock: {
      alignItems: 'flex-end',
      gap: 4,
    },
    amount: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    amountSettled: {
      color: theme.colors.success,
    },
    statusPillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    syncPendingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.neonCyan}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}40`,
    },
    syncPendingText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.neonCyan,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: `${theme.colors.warning}16`,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
    },
    statusPillPaid: {
      backgroundColor: `${theme.colors.success}16`,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
    },
    requisitesBox: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: theme.spacing.md,
    },
    requisiteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: 10,
    },
    requisiteIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requisiteInfo: {
      flex: 1,
    },
    requisiteLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    requisiteValue: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 1,
    },
    requisiteValueMissing: {
      color: theme.colors.warning,
      fontSize: 12,
      fontWeight: '500',
    },
    requisitesDivider: {
      height: 1,
      backgroundColor: theme.colors.surfaceBorder,
      marginLeft: 38,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    copyButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}66`,
      backgroundColor: `${theme.colors.primary}12`,
    },
    copyButtonDone: {
      borderColor: `${theme.colors.success}66`,
      backgroundColor: `${theme.colors.success}12`,
    },
    copyText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    remindButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: `${theme.colors.warning}50`,
      backgroundColor: `${theme.colors.warning}14`,
      gap: 5,
    },
    remindText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.warning,
    },
    shareButton: {
      width: 42,
      height: 40,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      backgroundColor: theme.colors.surfaceElevated,
    },
    settleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 11,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary,
    },
    settleButtonUndo: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    settleText: {
      color: theme.colors.textInverse,
      fontSize: 13,
      fontWeight: '800',
    },
    confettiContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'visible',
      zIndex: 99,
    },
    confettiParticle: {
      position: 'absolute',
      fontSize: 15,
    },
  });
}
