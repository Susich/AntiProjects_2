import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'neon';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  style,
  textStyle,
  haptic = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics may not be supported on all environments
      }
    }
    onPress();
  };

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
      case 'neon':
        return styles.primaryBtn;
      case 'secondary':
        return styles.secondaryBtn;
      case 'outline':
        return styles.outlineBtn;
      case 'danger':
        return styles.dangerBtn;
      case 'ghost':
        return styles.ghostBtn;
      default:
        return styles.primaryBtn;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
      case 'neon':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'danger':
        return styles.dangerText;
      case 'ghost':
        return styles.ghostText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  const getIconColor = (): string => {
    if (disabled) return theme.colors.textMuted;
    switch (variant) {
      case 'primary':
      case 'neon':
        return theme.colors.textInverse;
      case 'danger':
        return '#FFFFFF';
      case 'outline':
      case 'ghost':
        return theme.colors.primary;
      default:
        return theme.colors.textPrimary;
    }
  };

  const iconElement = icon ? (
    <Ionicons
      name={icon}
      size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18}
      color={getIconColor()}
      style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight}
    />
  ) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.baseBtn,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabledBtn,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'neon'
              ? theme.colors.textInverse
              : theme.colors.textPrimary
          }
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {iconPosition === 'left' && iconElement}
          <Text
            style={[
              styles.baseText,
              getTextStyle(),
              size === 'sm' && styles.textSm,
              size === 'lg' && styles.textLg,
              disabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {iconPosition === 'right' && iconElement}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    baseBtn: {
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    baseText: {
      fontWeight: '600',
      fontSize: 15,
    },
    iconLeft: {
      marginRight: 8,
    },
    iconRight: {
      marginLeft: 8,
    },

    // Sizes
    sizeSm: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.sm,
    },
    sizeMd: {
      paddingVertical: 13,
      paddingHorizontal: 18,
    },
    sizeLg: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: theme.borderRadius.lg,
    },
    textSm: {
      fontSize: 13,
    },
    textLg: {
      fontSize: 17,
      fontWeight: '700',
    },

    // Variants
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      ...theme.shadows.neonGreen,
    },
    primaryText: {
      color: theme.colors.textInverse,
      fontWeight: '700',
    },

    secondaryBtn: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    secondaryText: {
      color: theme.colors.textPrimary,
    },

    outlineBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    outlineText: {
      color: theme.colors.primary,
    },

    dangerBtn: {
      backgroundColor: theme.colors.danger,
    },
    dangerText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    ghostBtn: {
      backgroundColor: 'transparent',
    },
    ghostText: {
      color: theme.colors.primary,
    },

    disabledBtn: {
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: 'transparent',
      opacity: 0.5,
      shadowOpacity: 0,
      elevation: 0,
    },
    disabledText: {
      color: theme.colors.textMuted,
    },
  });
