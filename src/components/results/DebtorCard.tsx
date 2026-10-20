import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { SimplifiedDebtTransfer } from '../../types';
import { formatPhone, formatRubles, getInitials } from '../../utils/currency';
import { copyToClipboard, payToCreditor } from '../../utils/deepLinks';
import { shareSingleTransfer } from '../../utils/shareText';
import { useToast } from '../common/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DebtorCardProps {
  transfer: SimplifiedDebtTransfer;
  partyTitle: string;
  onToggleSettled: (transferId: string) => void;
}

export const DebtorCard: React.FC<DebtorCardProps> = ({
  transfer,
  partyTitle,
  onToggleSettled,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showToast } = useToast();

  const creditorPhone = transfer.toUser.paymentInfo.phone;
  const creditorUrl = transfer.toUser.paymentInfo.sbpQrOrUrl;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  // Action 1: "Оплатить" (Pay)
  const handlePay = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const result = await payToCreditor(transfer.toUser, transfer.amount);
    if (result.success) {
      showToast(result.message, {
        type: 'success',
        icon: 'flash-outline',
      });
      return;
    }

    // The number is already in the clipboard. Offer the last helpful actions:
    // copy the exact amount and, if a link exists, retry it once more.
    const buttons: {
      text: string;
      style?: 'cancel' | 'default';
      onPress?: () => void;
    }[] = [];

    if (creditorUrl) {
      buttons.push({
        text: 'Открыть ссылку',
        onPress: () => {
          const trimmed = creditorUrl.trim();
          const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
            ? trimmed
            : `https://${trimmed}`;
          Linking.openURL(url).catch((err) =>
            console.warn('[SBP] Failed to open payment link:', err)
          );
        },
      });
    }

    buttons.push({
      text: 'Скопировать сумму',
      onPress: () => {
        void copyToClipboard(String(transfer.amount));
        showToast(`Сумма ${formatRubles(transfer.amount)} скопирована`, {
          type: 'info',
          icon: 'copy-outline',
        });
      },
    });
    buttons.push({ text: 'Понятно', style: 'cancel' });

    Alert.alert('Оплата по СБП', result.message, buttons);
  };

  // Action 2: Share transfer to Debtor
  const handleShareToDebtor = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const formattedAmount = formatRubles(transfer.amount);
    if (creditorPhone) {
      await copyToClipboard(creditorPhone);
    }

    showToast(`Реквизиты для перевода ${formattedAmount} скопированы!`, {
      type: 'info',
      icon: 'copy-outline',
    });

    await shareSingleTransfer(transfer, partyTitle);
  };

  // Action 3: Toggle Settled status
  const handleToggleSettled = () => {
    try {
      Haptics.notificationAsync(
        transfer.isSettled
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    } catch {}

    onToggleSettled(transfer.id);
    showToast(
      transfer.isSettled
        ? `Перевод от ${transfer.fromUser.name} отмечен как ожидающий`
        : `🎉 Перевод от ${transfer.fromUser.name} на ${formatRubles(transfer.amount)} закрыт!`,
      { type: transfer.isSettled ? 'info' : 'success' }
    );
  };

  return (
    <View
      style={[
        styles.cardContainer,
        transfer.isSettled ? styles.cardSettled : styles.cardUnsettled,
      ]}
    >
      {/* Top Header: [Debtor] transfers [Amount] ₽ ➔ [Creditor] */}
      <View style={styles.topTransferRow}>
        {/* Debtor info */}
        <View style={styles.participantCol}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: transfer.fromUser.avatarColor || theme.colors.neonPink },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(transfer.fromUser.name)}</Text>
          </View>
          <Text style={styles.participantName} numberOfLines={1}>
            {transfer.fromUser.name}
          </Text>
          <Text style={styles.roleLabel}>Должник</Text>
        </View>

        {/* Transfer Center Indicator */}
        <View style={styles.transferMiddle}>
          <Text
            style={[
              styles.transferAmount,
              transfer.isSettled && styles.transferAmountSettled,
            ]}
          >
            {formatRubles(transfer.amount)}
          </Text>
          <View style={styles.arrowRow}>
            <View style={styles.arrowLine} />
            <Ionicons
              name="arrow-forward"
              size={18}
              color={transfer.isSettled ? theme.colors.success : theme.colors.info}
            />
          </View>
        </View>

        {/* Creditor info */}
        <View style={styles.participantCol}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: transfer.toUser.avatarColor || theme.colors.success },
            ]}
          >
            <Text style={styles.avatarText}>{getInitials(transfer.toUser.name)}</Text>
          </View>
          <Text style={styles.participantName} numberOfLines={1}>
            {transfer.toUser.name}
          </Text>
          <Text style={[styles.roleLabel, { color: theme.colors.success }]}>
            Кредитор
          </Text>
        </View>
      </View>

      {/* Creditor Requisites Box */}
      <View style={styles.requisitesCard}>
        <View style={styles.requisitesHeader}>
          <Ionicons
            name="card-outline"
            size={14}
            color={theme.colors.success}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.requisitesTitle}>
            Реквизиты получателя ({transfer.toUser.name})
          </Text>
        </View>

        <View style={styles.requisitesContent}>
          {/* SBP Badge: no bank selection — payments go through any SBP bank */}
          <View
            style={[
              styles.sbpPill,
              {
                backgroundColor: `${theme.colors.info}22`,
                borderColor: `${theme.colors.info}66`,
              },
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={13}
              color={theme.colors.info}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.sbpPillText, { color: theme.colors.info }]}>
              СБП
            </Text>
          </View>

          {/* Phone for SBP */}
          {creditorPhone ? (
            <TouchableOpacity
              onPress={async () => {
                await copyToClipboard(String(creditorPhone));
                showToast(`Номер ${formatPhone(creditorPhone)} скопирован!`);
              }}
              style={styles.phoneChip}
              activeOpacity={0.7}
            >
              <Ionicons
                name="call-outline"
                size={13}
                color={theme.colors.textPrimary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.phoneChipText}>{formatPhone(creditorPhone)}</Text>
              <Ionicons
                name="copy-outline"
                size={12}
                color={theme.colors.textMuted}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPhoneHint}>Телефон СБП не указан</Text>
          )}
        </View>

        {/* Personal SBP link, if the creditor shared one */}
        {creditorUrl ? (
          <View style={styles.urlBadge}>
            <Ionicons
              name="link-outline"
              size={12}
              color={theme.colors.info}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.urlBadgeText} numberOfLines={1}>
              {creditorUrl}
            </Text>
          </View>
        ) : (
          <Text style={styles.noLinkHint}>
            СБП-ссылка не указана: «Оплатить» скопирует номер для перевода в вашем банке.
          </Text>
        )}
      </View>

      {/* Accordion Toggle for Explanation */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.expandToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.expandToggleText}>
          {isExpanded ? 'Скрыть обоснование расчёта' : 'Почему такой расчёт? (Взаимозачёт)'}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      {/* Expanded Explanation */}
      {isExpanded && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationText}>
            ⚡ Алгоритм сведения долгов (Debt Simplification) подсчитал чистый баланс:
          </Text>
          <Text style={styles.explanationBullet}>
            •{' '}
            <Text style={styles.explanationName}>{transfer.fromUser.name}</Text> потребил(а)
            больше, чем оплатил(а) из своего кармана.
          </Text>
          <Text style={styles.explanationBullet}>
            •{' '}
            <Text style={styles.explanationName}>{transfer.toUser.name}</Text> оплатил(а)
            общие чеки и ожидает возврат.
          </Text>
          <Text style={styles.explanationNote}>
            Прямой перевод закрывает долг сразу, исключая цепочки промежуточных платежей.
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        {/* Action 1: Pay */}
        <TouchableOpacity onPress={handlePay} style={styles.payBtn} activeOpacity={0.8}>
          <Ionicons
            name={creditorUrl ? 'open-outline' : 'flash-outline'}
            size={16}
            color={theme.colors.textInverse}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.payBtnText}>Оплатить по СБП</Text>
        </TouchableOpacity>

        {/* Action 2: Share to Debtor */}
        <TouchableOpacity
          onPress={handleShareToDebtor}
          style={styles.shareBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane-outline" size={16} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Action 3: Quick Toggle Settled */}
        <TouchableOpacity
          onPress={handleToggleSettled}
          style={[styles.settledCheckBtn, transfer.isSettled && styles.settledCheckBtnActive]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={transfer.isSettled ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={22}
            color={transfer.isSettled ? theme.colors.success : theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    cardContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1.5,
      ...theme.shadows.card,
    },
    cardUnsettled: {
      borderColor: theme.colors.surfaceBorder,
    },
    cardSettled: {
      borderColor: `${theme.colors.success}66`,
      backgroundColor: theme.colors.surfaceElevated,
    },
    topTransferRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    participantCol: {
      alignItems: 'center',
      width: 80,
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarText: {
      color: theme.colors.textInverse,
      fontWeight: '800',
      fontSize: 15,
    },
    participantName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    roleLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    transferMiddle: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    transferAmount: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.colors.success,
      letterSpacing: -0.4,
    },
    transferAmountSettled: {
      color: theme.colors.success,
      opacity: 0.9,
    },
    arrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '80%',
      justifyContent: 'center',
      marginTop: 2,
    },
    arrowLine: {
      flex: 1,
      height: 1.5,
      backgroundColor: `${theme.colors.info}4D`,
      marginRight: 4,
    },
    requisitesCard: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    requisitesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    requisitesTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    requisitesContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    sbpPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
    },
    sbpPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    noLinkHint: {
      fontSize: 10,
      lineHeight: 14,
      color: theme.colors.textMuted,
      marginTop: 6,
    },
    phoneChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    phoneChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    noPhoneHint: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontStyle: 'italic',
    },
    urlBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
    urlBadgeText: {
      fontSize: 11,
      color: theme.colors.info,
      flex: 1,
    },
    expandToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      marginBottom: 10,
    },
    expandToggleText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    explanationBox: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    explanationText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      fontWeight: '600',
    },
    explanationBullet: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 2,
      lineHeight: 16,
    },
    explanationName: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    explanationNote: {
      fontSize: 10,
      color: theme.colors.info,
      marginTop: 4,
      fontStyle: 'italic',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    payBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      ...theme.shadows.neonGreen,
    },
    payBtnText: {
      color: theme.colors.textInverse,
      fontSize: 13,
      fontWeight: '700',
    },
    shareBtn: {
      width: 44,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    settledCheckBtn: {
      width: 44,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    settledCheckBtnActive: {
      borderColor: theme.colors.success,
      backgroundColor: `${theme.colors.success}1A`,
    },
  });
