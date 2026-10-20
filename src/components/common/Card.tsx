import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  headerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  variant?: 'default' | 'elevated' | 'bordered' | 'accent';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  icon,
  iconColor,
  rightAction,
  style,
  headerStyle,
  contentStyle,
  variant = 'default',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedIconColor = iconColor || theme.colors.primary;

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return styles.cardElevated;
      case 'bordered':
        return styles.cardBordered;
      case 'accent':
        return styles.cardAccent;
      default:
        return styles.cardDefault;
    }
  };

  const hasHeader = title || subtitle || icon || rightAction;

  return (
    <View style={[styles.baseCard, getVariantStyle(), style]}>
      {hasHeader && (
        <View style={[styles.header, headerStyle]}>
          <View style={styles.headerLeft}>
            {icon && (
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: `${resolvedIconColor}1A` },
                ]}
              >
                <Ionicons name={icon} size={18} color={resolvedIconColor} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {rightAction && <View style={styles.headerRight}>{rightAction}</View>}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    baseCard: {
      borderRadius: theme.borderRadius.lg,
      padding: 16,
      marginBottom: 16,
      ...theme.shadows.card,
    },
    cardDefault: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    cardElevated: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    cardBordered: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceBorderActive,
    },
    cardAccent: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.textPrimary}14`,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerRight: {
      marginLeft: 12,
    },
    iconContainer: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    content: {},
  });
