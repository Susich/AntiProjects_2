import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ParticipantProfile } from '../../types';
import { formatPhone, cleanPhone, getAvatarColor, getInitials } from '../../utils/currency';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<ParticipantProfile, 'id'>) => void;
  editProfile?: ParticipantProfile | null;
  initialName?: string;
  title?: string;
  submitLabel?: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  onSave,
  editProfile,
  initialName,
  title,
  submitLabel,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? (
      <ProfileForm
        onClose={onClose}
        onSave={onSave}
        editProfile={editProfile}
        initialName={initialName}
        title={title}
        submitLabel={submitLabel}
      />
    ) : null}
  </Modal>
);

const ProfileForm: React.FC<Omit<ProfileModalProps, 'visible'>> = ({
  onClose,
  onSave,
  editProfile,
  initialName,
  title,
  submitLabel,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  // The form is mounted only while the modal is visible, so initial values
  // are read from props once and every reopening starts with a clean form.
  const [name, setName] = useState(editProfile?.name ?? initialName ?? '');
  const [phone, setPhone] = useState(
    formatPhone(editProfile?.paymentInfo?.phone ?? '')
  );
  const [sbpQrOrUrl, setSbpQrOrUrl] = useState(
    editProfile?.paymentInfo?.sbpQrOrUrl ?? ''
  );
  const [avatarColor, setAvatarColor] = useState(
    editProfile?.avatarColor || getAvatarColor(editProfile?.name || initialName || 'Друг')
  );

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
    if (phoneError) setPhoneError('');
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (!editProfile && text.trim().length > 0) {
      setAvatarColor(getAvatarColor(text.trim()));
    }
    if (nameError) setNameError('');
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const digits = cleanPhone(phone);

    let isValid = true;
    if (!trimmedName) {
      setNameError('Укажите имя или никнейм');
      isValid = false;
    }

    if (digits.length < 10) {
      setPhoneError('Укажите номер телефона — он нужен для переводов по СБП');
      isValid = false;
    }

    if (!isValid) return;

    onSave({
      name: trimmedName,
      avatarColor,
      paymentInfo: {
        phone: digits,
        sbpQrOrUrl: sbpQrOrUrl.trim() || undefined,
      },
    });

    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}
    >
      <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>
              {title || (editProfile ? 'Редактировать профиль' : 'Новый участник')}
            </Text>
            <Text style={styles.sheetSubtitle}>
              Имя, телефон и СБП-ссылка для переводов
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
          {/* Live Profile Header Preview */}
          <View style={styles.previewAvatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitials}>{getInitials(name || 'Друг')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName}>{name.trim() || 'Имя участника'}</Text>
              <Text style={styles.previewDetails}>
                {phone ? `СБП • ${phone}` : 'Телефон для СБП не указан'}
              </Text>
            </View>
          </View>

          {/* Input: Name */}
          <Input
            label="Имя или никнейм *"
            placeholder="Например: Влад или @vlad_party"
            value={name}
            onChangeText={handleNameChange}
            error={nameError}
            leftIcon="person-outline"
            clearButton
          />

          {/* Input: Phone for SBP */}
          <Input
            label="Номер телефона для СБП *"
            placeholder="+7 (999) 123-45-67"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={handlePhoneChange}
            error={phoneError}
            leftIcon="call-outline"
            helperText="На этот номер друзья будут отправлять долг через Систему быстрых платежей"
            clearButton
          />

          {/* Input: Personal SBP link / QR */}
          <Input
            label="СБП-ссылка или QR (необязательно)"
            placeholder="https://qr.nspk.ru/..."
            value={sbpQrOrUrl}
            onChangeText={setSbpQrOrUrl}
            leftIcon="link-outline"
            helperText="Получите в банке: СБП → «Поделиться реквизитами». Тогда «Оплатить» откроет банк плательщика сразу с реквизитами."
            autoCapitalize="none"
            autoCorrect={false}
            clearButton
          />

          <View style={styles.tipBox}>
            <Ionicons name="flash-outline" size={16} color={theme.colors.info} />
            <Text style={styles.tipText}>
              Банк выбирать не нужно: СБП работает между всеми банками.
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.sheetActions}>
          <Button
            title="Отмена"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ flex: 1, marginRight: 10 }}
          />
          <Button
            title={submitLabel || (editProfile ? 'Сохранить изменения' : 'Создать профиль')}
            variant="primary"
            size="md"
            icon="checkmark-circle"
            onPress={handleSave}
            style={{ flex: 1.8 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorderActive,
      ...theme.shadows.card,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    previewAvatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      marginBottom: 16,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    avatarInitials: {
      color: theme.colors.textInverse,
      fontSize: 18,
      fontWeight: '900',
    },
    previewName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    previewDetails: {
      fontSize: 12,
      color: theme.colors.info,
      marginTop: 2,
    },
    tipBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: `${theme.colors.info}12`,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: `${theme.colors.info}35`,
      padding: 11,
      marginTop: 4,
      gap: 8,
    },
    tipText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    sheetActions: {
      flexDirection: 'row',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
    },
  });
