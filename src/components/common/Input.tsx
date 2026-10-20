import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  prefix?: string;
  suffix?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  clearButton?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  prefix,
  suffix,
  containerStyle,
  inputStyle,
  clearButton = false,
  value,
  onChangeText,
  ...restProps
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  const hasValue = Boolean(value && value.length > 0);
  const iconColor = error
    ? theme.colors.neonPink
    : isFocused
    ? theme.colors.primary
    : theme.colors.textMuted;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={iconColor} style={styles.leftIcon} />
        )}
        {prefix && <Text style={styles.affixText}>{prefix}</Text>}
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChangeText={onChangeText}
          selectionColor={theme.colors.primary}
          {...restProps}
        />
        {suffix && <Text style={styles.affixText}>{suffix}</Text>}
        {clearButton && hasValue && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionIcon}
          >
            <Ionicons name="close-circle" size={17} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
        {rightIcon && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.actionIcon}
          >
            <Ionicons name={rightIcon} size={18} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle"
            size={13}
            color={theme.colors.neonPink}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 7,
      letterSpacing: 0.2,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.surfaceBorder,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14,
      minHeight: 48,
    },
    inputWrapperFocused: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceElevated,
    },
    inputWrapperError: {
      borderColor: theme.colors.neonPink,
    },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 15,
      paddingVertical: 10,
      fontWeight: '500',
    },
    leftIcon: {
      marginRight: 10,
    },
    actionIcon: {
      marginLeft: 8,
      padding: 2,
    },
    affixText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      marginRight: 6,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
      marginLeft: 2,
    },
    errorText: {
      color: theme.colors.neonPink,
      fontSize: 12,
      fontWeight: '500',
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginTop: 5,
      marginLeft: 2,
    },
  });
