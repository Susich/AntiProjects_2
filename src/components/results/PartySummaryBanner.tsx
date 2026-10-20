import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { DebtCalculationResult } from '../../types';
import { formatRubles } from '../../utils/currency';
import { generatePartySettlementSummary } from '../../utils/shareText';
import { copyToClipboard } from '../../utils/deepLinks';
import { useToast } from '../common/Toast';

interface PartySummaryBannerProps {
  calculation: DebtCalculationResult;
  partyTitle: string;
}

export const PartySummaryBanner: React.FC<PartySummaryBannerProps> = ({
  calculation,
  partyTitle,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();

  const handleShareFullSummary = async () => {
    const text = generatePartySettlementSummary(calculation, partyTitle);
    await copyToClipboard(text);
    showToast('Сводка взаимозачёта скопирована в буфер!', {
      icon: 'copy-outline',
      type: 'success',
    });
    try {
      await Share.share({ message: text });
    } catch {
      // Игнорируем ошибку шаринга
    }
  };

  const totalTransfersAmount =
    calculation.totalSettledAmount + calculation.totalPendingAmount;

  const progressPercent =
    totalTransfersAmount > 0
      ? Math.min(
          100,
          Math.round((calculation.totalSettledAmount / totalTransfersAmount) * 100)
        )
      : 100;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerLabel}>ОБЩИЕ РАСХОДЫ</Text>
          <Text style={styles.grandTotalText}>{formatRubles(calculation.totalExpenses)}</Text>
        </View>

        <TouchableOpacity
          onPress={handleShareFullSummary}
          style={styles.shareAllBtn}
          activeOpacity={0.8}
        >
          <Ionicons
            name="share-social-outline"
            size={16}
            color={theme.colors.textInverse}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.shareAllText}>Поделиться сводкой</Text>
        </TouchableOpacity>
      </View>

      {/* Sub totals & Minimization metric */}
      <View style={styles.subTotalsRow}>
        <View style={styles.subTotalItem}>
          <Text style={styles.subTotalLabel}>Переводов</Text>
          <Text style={styles.subTotalValue}>{calculation.transfers.length}</Text>
        </View>
        <View style={styles.subTotalDivider} />
        <View style={styles.subTotalItem}>
          <Text style={styles.subTotalLabel}>Кредиторов</Text>
          <Text style={styles.subTotalValue}>{calculation.creditors.length}</Text>
        </View>
        <View style={styles.subTotalDivider} />
        <View style={styles.subTotalItem}>
          <Text style={styles.subTotalLabel}>Должников</Text>
          <Text style={styles.subTotalValue}>{calculation.debtors.length}</Text>
        </View>
      </View>

      {/* Progress of Transfers Settlement */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text style={styles.collectedText}>
            Оплачено:{' '}
            <Text style={styles.collectedNumber}>
              {formatRubles(calculation.totalSettledAmount)}
            </Text>{' '}
            ({progressPercent}%)
          </Text>
          <Text style={styles.pendingText}>
            Ожидает: {formatRubles(calculation.totalPendingAmount)}
          </Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Unassigned Warning */}
      {calculation.unassignedExpensesCount > 0 && (
        <View style={styles.warningContainer}>
          <Ionicons
            name="alert-circle"
            size={16}
            color={theme.colors.danger}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.warningText}>
            {calculation.unassignedExpensesCount} счетов на{' '}
            {formatRubles(calculation.unassignedCost)} не распределены!
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    bannerContainer: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.xl,
      padding: 18,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceBorderActive,
      marginBottom: 18,
      ...theme.shadows.card,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    bannerLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.textMuted,
      letterSpacing: 1,
    },
    grandTotalText: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.colors.success,
      letterSpacing: -0.5,
      marginTop: 2,
    },
    shareAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.md,
    },
    shareAllText: {
      color: theme.colors.textInverse,
      fontWeight: '700',
      fontSize: 12,
    },
    subTotalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      marginBottom: 14,
    },
    subTotalItem: {
      alignItems: 'center',
    },
    subTotalLabel: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '500',
    },
    subTotalValue: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    subTotalDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.colors.surfaceBorder,
    },
    progressSection: {
      marginTop: 2,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
      gap: 8,
    },
    collectedText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    collectedNumber: {
      color: theme.colors.success,
      fontWeight: '700',
    },
    pendingText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: 4,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: `${theme.colors.danger}1F`,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.sm,
    },
    warningText: {
      color: theme.colors.danger,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
  });
