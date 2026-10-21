import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BANKS } from '../../constants/banks';
import { Input } from './Input';

interface BankPickerProps {
  label?: string;
  value: string;
  onChange: (bank: string) => void;
  helperText?: string;
  compact?: boolean;
}

const PREDEFINED_BANKS = BANKS.filter((b) => b !== 'Другой банк');

export const BankPicker: React.FC<BankPickerProps> = ({
  label = 'Банк',
  value,
  onChange,
  helperText,
  compact = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const isPredefined = PREDEFINED_BANKS.includes(value as any);
  const [isCustomMode, setIsCustomMode] = useState(!isPredefined && Boolean(value));
  const [customBankName, setCustomBankName] = useState(
    !isPredefined && value && value !== 'Другой банк' ? value : ''
  );

  // Sync state if value prop changes externally
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    const nextIsPredefined = PREDEFINED_BANKS.includes(value as any);
    if (nextIsPredefined) {
      setIsCustomMode(false);
    } else if (value) {
      setIsCustomMode(true);
      if (value !== 'Другой банк' && value !== customBankName) {
        setCustomBankName(value);
      }
    }
  }

  const handleSelectPredefined = (bank: string) => {
    setIsCustomMode(false);
    onChange(bank);
  };

  const handleSelectCustomMode = () => {
    setIsCustomMode(true);
    onChange(customBankName.trim() || 'Другой банк');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const handleCustomBankChange = (text: string) => {
    setCustomBankName(text);
    onChange(text.trim() ? text : 'Другой банк');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grid}>
        {BANKS.map((bank) => {
          const isOther = bank === 'Другой банк';
          const selected = isOther ? isCustomMode : !isCustomMode && value === bank;

          return (
            <TouchableOpacity
              key={bank}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => (isOther ? handleSelectCustomMode() : handleSelectPredefined(bank))}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {selected ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={theme.colors.primary}
                />
              ) : null}
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {bank}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isCustomMode ? (
        <View style={styles.customInputWrapper}>
          <Input
            inputRef={inputRef}
            label="Название вашего банка"
            placeholder="Например, Почта Банк, ПСБ, Точка..."
            value={customBankName}
            onChangeText={handleCustomBankChange}
            leftIcon="card-outline"
            autoCapitalize="words"
            maxLength={35}
            clearButton
            containerStyle={styles.customInput}
            helperText="Укажите название банка для перевода через СБП"
          />
        </View>
      ) : null}

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
};

function createStyles(theme: ThemeTokens, compact: boolean) {
  return StyleSheet.create({
    container: {
      marginBottom: compact ? theme.spacing.sm : theme.spacing.lg,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: theme.spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: compact ? 7 : 9,
      paddingHorizontal: compact ? 10 : 12,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      backgroundColor: theme.colors.surface,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}1A`,
    },
    chipText: {
      color: theme.colors.textSecondary,
      fontSize: compact ? 12 : 13,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    customInputWrapper: {
      marginTop: theme.spacing.md,
    },
    customInput: {
      marginBottom: 0,
    },
    helper: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: theme.spacing.sm,
    },
  });
}
