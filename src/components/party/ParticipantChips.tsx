import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../../store/usePartyStore';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { formatPhone } from '../../utils/currency';
import { FadeSlideIn } from '../common/FadeSlideIn';
import { Avatar } from '../common/Avatar';

interface ParticipantChipsProps {
  onOpenCloud?: () => void;
}

export const ParticipantChips: React.FC<ParticipantChipsProps> = ({ onOpenCloud }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const currentParty = usePartyStore((s) => s.currentParty);
  const session = usePartyStore((s) => s.session);

  const participants = currentParty.participants || [];
  const isSelf = (id: string) => session?.user.id === id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={17} color={theme.colors.primary} />
          <Text style={styles.title}>Участники комнаты</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{participants.length}</Text>
        </View>
      </View>

      {participants.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="person-add-outline" size={22} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>
            В комнате пока нет участников. Войдите в аккаунт и создайте комнату.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {participants.map((participant, index) => (
            <FadeSlideIn key={participant.id} index={index} style={styles.slideItem}>
              <View style={styles.chip}>
                <Avatar
                  url={participant.avatarUrl}
                  name={participant.name}
                  color={participant.avatarColor}
                  size={38}
                />
                <View style={styles.chipInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {participant.name || 'Участник'}
                    </Text>
                    {isSelf(participant.id) ? (
                      <Text style={styles.selfBadge}>вы</Text>
                    ) : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[
                      participant.bank,
                      participant.phone ? formatPhone(participant.phone) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Участник'}
                  </Text>
                </View>
              </View>
            </FadeSlideIn>
          ))}
        </View>
      )}

      {!currentParty.code ? (
        <View style={styles.hint}>
          <Ionicons name="people-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.hintText}>
            Создайте общую комнату, чтобы друзья подключились по коду.
          </Text>
          {onOpenCloud ? (
            <TouchableOpacity
              style={styles.hintButton}
              onPress={onOpenCloud}
              accessibilityRole="button"
            >
              <Text style={styles.hintButtonText}>Создать</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : currentParty.code ? (
        <View style={styles.hint}>
          <Ionicons name="key-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.hintText}>
            Код для друзей: <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{currentParty.code}</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    countPill: {
      minWidth: 26,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}18`,
      paddingHorizontal: 7,
    },
    countText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    grid: {
      width: '100%',
      gap: theme.spacing.sm,
    },
    slideItem: {
      width: '100%',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      width: '100%',
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.colors.textInverse,
      fontSize: 13,
      fontWeight: '800',
    },
    chipInfo: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      flexShrink: 1,
    },
    selfBadge: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
      backgroundColor: `${theme.colors.primary}18`,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: 'hidden',
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    emptyText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: theme.spacing.sm,
      paddingHorizontal: 2,
    },
    hintText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    hintButton: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.primary}18`,
    },
    hintButtonText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
