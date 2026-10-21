import React, { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { usePartyStore } from '../../store/usePartyStore';
import { cleanPhone } from '../../utils/currency';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { BankPicker } from '../common/BankPicker';
import { PhoneInput } from '../common/PhoneInput';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { useToast } from '../common/Toast';
import { Avatar } from '../common/Avatar';
import {
  pickAvatarFromGallery,
  takeAvatarWithCamera,
  saveAvatarLocally,
} from '../../services/avatarService';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ visible, onClose }) => {
  const session = usePartyStore((s) => s.session);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="88%"
      maxHeight="92%"
    >
      {({ onScroll }) =>
        visible ? (
          <ProfileEditForm
            key={`${session?.user.id || 'guest'}_${visible}`}
            onClose={onClose}
            onScroll={onScroll}
          />
        ) : null
      }
    </BottomSheetModal>
  );
};

const ProfileEditForm: React.FC<{
  onClose: () => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}> = ({ onClose, onScroll }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const session = usePartyStore((s) => s.session);
  const updateCurrentUser = usePartyStore((s) => s.updateCurrentUser);

  const [name, setName] = useState(session?.user.name ?? '');
  const [phone, setPhone] = useState(
    session?.user.phone ? cleanPhone(session.user.phone) : ''
  );
  const [bank, setBank] = useState(session?.user.bank ?? 'Сбербанк');
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    session?.user.avatarUrl
  );
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickFromGallery = async () => {
    if (!session || pickingAvatar) return;
    setPickingAvatar(true);
    try {
      const res = await pickAvatarFromGallery();
      if (res) {
        const permanentUri = await saveAvatarLocally(res.uri, session.user.id);
        setAvatarUrl(permanentUri);
        showToast('Фото выбрано', { type: 'info' });
      }
    } finally {
      setPickingAvatar(false);
    }
  };

  const handleTakeWithCamera = async () => {
    if (!session || pickingAvatar) return;
    setPickingAvatar(true);
    try {
      const res = await takeAvatarWithCamera();
      if (res) {
        const permanentUri = await saveAvatarLocally(res.uri, session.user.id);
        setAvatarUrl(permanentUri);
        showToast('Фото сделано', { type: 'info' });
      }
    } finally {
      setPickingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (saving || !session) return;
    setError('');

    const normalizedPhone = cleanPhone(phone);
    if (name.trim().length < 2) {
      setError('Укажите имя (минимум 2 символа)');
      return;
    }
    if (normalizedPhone.length !== 11 || !normalizedPhone.startsWith('7')) {
      setError('Введите корректный номер телефона');
      return;
    }
    if (newPassword && newPassword.length < 4) {
      setError('Новый пароль должен быть не короче 4 символов');
      return;
    }

    const finalAvatarUrl = avatarUrl !== undefined ? avatarUrl : session.user.avatarUrl;
    const hasPassword = Boolean(newPassword);

    if (!hasPassword) {
      // Optimistic profile update: close modal instantly without waiting for network roundtrip
      void updateCurrentUser({
        name: name.trim(),
        phone: normalizedPhone,
        bank,
        avatarUrl: finalAvatarUrl,
      });
      showToast('Профиль обновлён', { type: 'success' });
      onClose();
      return;
    }

    setSaving(true);
    const res = await updateCurrentUser({
      name: name.trim(),
      phone: normalizedPhone,
      bank,
      avatarUrl: finalAvatarUrl,
      newPassword,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.error || 'Не удалось обновить профиль');
      return;
    }

    showToast('Профиль обновлён', { type: 'success' });
    onClose();
  };

  const scrollRef = useRef<any>(null);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.keyboard}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Личные данные</Text>
            <Text style={styles.subtitle}>Имя, телефон, аватарка и банк</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={17} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Interactive Avatar Picker Section */}
          <View style={styles.avatarSection}>
            <Avatar
              url={avatarUrl}
              name={name || session?.user.name}
              color={session?.user.avatarColor}
              size={86}
              showEditBadge
              badgeIcon="camera"
              onPress={handlePickFromGallery}
              accessibilityLabel="Изменить аватарку"
            />
            <View style={styles.avatarActions}>
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={handlePickFromGallery}
                disabled={pickingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Выбрать фото из галереи"
              >
                <Ionicons name="images-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.avatarButtonText}>Галерея</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarButton}
                onPress={handleTakeWithCamera}
                disabled={pickingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Сделать снимок камерой"
              >
                <Ionicons name="camera-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.avatarButtonText}>Камера</Text>
              </TouchableOpacity>

              {avatarUrl ? (
                <TouchableOpacity
                  style={[styles.avatarButton, styles.avatarDeleteButton]}
                  onPress={() => setAvatarUrl(null)}
                  disabled={pickingAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Удалить аватарку"
                >
                  <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                  <Text style={[styles.avatarButtonText, { color: theme.colors.danger }]}>
                    Удалить
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Input
            label="Имя"
            placeholder="Как вас зовут"
            leftIcon="person-outline"
            value={name}
            onFocus={() => {
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={40}
          />

          <PhoneInput
            label="Номер телефона"
            value={phone}
            onChangeText={setPhone}
          />

          <BankPicker
            label="Банк по умолчанию"
            value={bank}
            onChange={setBank}
            helperText="При входе в комнату банк можно подтвердить отдельно."
          />

          <Input
            label="Новый пароль"
            placeholder="Оставьте пустым, чтобы не менять"
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword((value) => !value)}
            value={newPassword}
            onFocus={() => {
              scrollRef.current?.scrollTo({ y: 220, animated: true });
            }}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Button
            title="Сохранить изменения"
            icon="checkmark-outline"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            size="lg"
            style={styles.saveButton}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    keyboard: {
      flex: 1,
      width: '100%',
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 4,
    },
    scrollView: {
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
      maxHeight: '100%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceBorder,
      marginBottom: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginTop: 3,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    avatarSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
      paddingVertical: theme.spacing.xs,
    },
    avatarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: theme.spacing.md,
    },
    avatarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 13,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    avatarButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    avatarDeleteButton: {
      borderColor: `${theme.colors.danger}40`,
      backgroundColor: `${theme.colors.danger}12`,
    },
    content: {
      paddingBottom: theme.spacing.md,
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
    },
    footer: {
      paddingTop: theme.spacing.sm,
      paddingBottom: 2,
    },
    saveButton: {
      width: '100%',
    },
  });
}
