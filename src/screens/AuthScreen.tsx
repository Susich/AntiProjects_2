import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../context/ThemeContext';
import { usePartyStore } from '../store/usePartyStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { loginUserInCloud, registerUserInCloud } from '../api/googleSheets';
import { DEFAULT_BANK } from '../constants/banks';
import { cleanPhone } from '../utils/currency';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { BankPicker } from '../components/common/BankPicker';
import { PhoneInput } from '../components/common/PhoneInput';

type AuthMode = 'login' | 'register';

export const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const setSession = usePartyStore((s) => s.setSession);

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState<string>(DEFAULT_BANK);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    if (loading || nextMode === mode) return;
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (loading) return;
    setError('');

    const normalizedPhone = cleanPhone(phone);
    if (mode === 'register' && name.trim().length < 2) {
      setError('Укажите имя (минимум 2 символа)');
      return;
    }
    if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith('7')) {
      setError('Введите корректный номер телефона');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен быть не короче 4 символов');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const res =
        mode === 'register'
          ? await registerUserInCloud({
              name: name.trim(),
              phone: normalizedPhone,
              bank,
              password,
            })
          : await loginUserInCloud({
              phone: normalizedPhone,
              password,
            });

      if (!res.success || !res.user || !res.token) {
        setError(res.error || 'Не удалось выполнить вход');
        return;
      }

      setSession({ user: res.user, token: res.token });

      // Request notification permission at logical moment (right after authentication)
      const notifState = useNotificationStore.getState();
      if (notifState.permissionStatus === 'undetermined') {
        void notifState.requestPermission();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Ionicons name="people" size={34} color={theme.colors.textInverse} />
            </View>
            <Text style={styles.logoText}>PartySplit</Text>
            <Text style={styles.subtitle}>
              Общие чеки, честный расчёт{'\n'}и оплата без платёжных ссылок
            </Text>
          </View>

          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              onPress={() => switchMode('login')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.modeText, mode === 'login' && styles.modeTextActive]}
              >
                Вход
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
              onPress={() => switchMode('register')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.modeText, mode === 'register' && styles.modeTextActive]}
              >
                Регистрация
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === 'login' ? 'С возвращением' : 'Создайте профиль'}
            </Text>
            <Text style={styles.cardHint}>
              {mode === 'login'
                ? 'Войдите, чтобы открыть свои комнаты и статусы оплат.'
                : 'Имя, телефон и банк нужны, чтобы другие участники знали, кому переводить.'}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={17} color={theme.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {mode === 'register' ? (
              <Input
                label="Имя"
                placeholder="Как вас зовут"
                leftIcon="person-outline"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={40}
              />
            ) : null}

            <PhoneInput
              label="Номер телефона"
              value={phone}
              onChangeText={setPhone}
              returnKeyType="next"
            />

            {mode === 'register' ? (
              <BankPicker
                label="Ваш банк"
                value={bank}
                onChange={setBank}
                helperText="Банк можно подтвердить отдельно для каждой комнаты."
              />
            ) : null}

            <Input
              label="Пароль"
              placeholder="Минимум 4 символа"
              leftIcon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword((value) => !value)}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType={mode === 'register' ? 'next' : 'done'}
              onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
            />

            {mode === 'register' ? (
              <Input
                label="Повторите пароль"
                placeholder="Ещё раз"
                leftIcon="shield-checkmark-outline"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            ) : null}

            <Button
              title={mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              icon={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              size="lg"
              style={styles.submitButton}
            />

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Связываемся с Google Sheets...</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={13} color={theme.colors.textMuted} />
            <Text style={styles.privacyText}>
              Пароль хранится на сервере в виде соли и SHA-256 хеша.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </TouchableWithoutFeedback>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: theme.spacing.xl,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xxxl,
      justifyContent: 'center',
    },
    hero: {
      alignItems: 'center',
      marginBottom: theme.spacing.xxl,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      ...theme.shadows.neonGreen,
    },
    logoText: {
      color: theme.colors.textPrimary,
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.8,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    modeSwitch: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      marginBottom: theme.spacing.lg,
    },
    modeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
    },
    modeButtonActive: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    modeText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    modeTextActive: {
      color: theme.colors.textPrimary,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.xl,
      ...theme.shadows.card,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
      marginBottom: 4,
    },
    cardHint: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: theme.spacing.lg,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: `${theme.colors.danger}14`,
      borderColor: `${theme.colors.danger}55`,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      flex: 1,
      color: theme.colors.danger,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
    },
    submitButton: {
      marginTop: theme.spacing.sm,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: theme.spacing.md,
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    privacyText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      flexShrink: 1,
    },
  });
}
