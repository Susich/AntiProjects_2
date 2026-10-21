import React, { useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';

import { triggerImpact } from '../../utils/haptics';

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (disabled || loading) return;
    if (haptic) {
      void triggerImpact();
    }
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 260,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
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
    <View style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight}>
      <Ionicons
        name={icon}
        size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18}
        color={getIconColor()}
      />
    </View>
  ) : null;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        styles.baseBtn,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabledBtn,
        style,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'neon'
              ? theme.colors.textInverse || '#FFFFFF'
              : theme.colors.textPrimary
          }
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {iconPosition === 'left' && iconElement}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
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
    </AnimatedPressable>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    baseBtn: {
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      minHeight: 44,
      ...(Platform.OS === 'web'
        ? ({
            display: 'inline-flex',
            userSelect: 'none',
          } as any)
        : {}),
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: '100%',
      flexShrink: 0,
    },
    baseText: {
      fontWeight: '700',
      fontSize: 15,
      textAlign: 'center',
      letterSpacing: 0.2,
      ...(Platform.OS === 'web'
        ? ({
            whiteSpace: 'nowrap',
            userSelect: 'none',
          } as any)
        : {}),
    },
    iconLeft: {
      marginRight: 8,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconRight: {
      marginLeft: 8,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
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
