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

interface IdentityGateModalProps {
  visible: boolean;
  initialProfile?: ParticipantProfile | null;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSave: (data: Omit<ParticipantProfile, 'id'>) => void;
}

/**
 * Mandatory "who are you" form shown before creating or joining a cloud room.
 * The name and phone become the participant's SBP requisites in the shared
 * room, so no bank selection is needed anywhere in the app.
 */
export const IdentityGateModal: React.FC<IdentityGateModalProps> = ({
  visible,
  initialProfile,
  title = 'Ваши данные',
  subtitle = 'Имя и телефон увидят участники комнаты — по ним они переведут вам долг через СБП.',
  submitLabel = 'Продолжить',
  onCancel,
  onSave,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    {visible ? (
      <IdentityGateForm
        initialProfile={initialProfile}
        title={title}
        subtitle={subtitle}
        submitLabel={submitLabel}
        onCancel={onCancel}
        onSave={onSave}
      />
    ) : null}
  </Modal>
);

export const IdentityGateForm: React.FC<Omit<IdentityGateModalProps, 'visible'>> = ({
  initialProfile,
  title,
  subtitle,
  submitLabel = 'Продолжить',
  onCancel,
  onSave,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(initialProfile?.name ?? '');
  const [phone, setPhone] = useState(
    formatPhone(initialProfile?.paymentInfo?.phone ?? '')
  );
  const [sbpQrOrUrl, setSbpQrOrUrl] = useState(
    initialProfile?.paymentInfo?.sbpQrOrUrl ?? ''
  );
  const [avatarColor] = useState(
    initialProfile?.avatarColor || getAvatarColor(initialProfile?.name || 'Я')
  );

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
    if (phoneError) setPhoneError('');
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
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}
    >
      <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.sheetHeader}>
          <View style={styles.titleRow}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
          <View style={styles.previewAvatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarInitials}>{getInitials(name || 'Я')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName}>{name.trim() || 'Ваше имя'}</Text>
              <Text style={styles.previewDetails}>
                {phone ? `СБП • ${phone}` : 'Телефон для СБП не указан'}
              </Text>
            </View>
          </View>

          <Input
            label="Имя или никнейм *"
            placeholder="Например: Влад"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            error={nameError}
            leftIcon="person-outline"
            clearButton
          />

          <Input
            label="Телефон для СБП *"
            placeholder="+7 (999) 123-45-67"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={handlePhoneChange}
            error={phoneError}
            leftIcon="call-outline"
            helperText="На этот номер друзья смогут перевести вам долг через СБП из любого банка"
            clearButton
          />

          <Input
            label="СБП-ссылка или QR (необязательно)"
            placeholder="https://qr.nspk.ru/..."
            value={sbpQrOrUrl}
            onChangeText={setSbpQrOrUrl}
            leftIcon="link-outline"
            helperText="Возьмите её в своём банке: СБП → «Поделиться реквизитами». Тогда «Оплатить» откроет банк плательщика в один тап."
            autoCapitalize="none"
            autoCorrect={false}
            clearButton
          />

          <View style={styles.tipBox}>
            <Ionicons name="flash-outline" size={16} color={theme.colors.info} />
            <Text style={styles.tipText}>
              Банк указывать не нужно: переводы идут через Систему быстрых платежей,
              а приложение банка плательщик выбирает у себя.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.sheetActions}>
          <Button
            title="Отмена"
            variant="secondary"
            size="md"
            onPress={onCancel}
            style={{ flex: 1, marginRight: 10 }}
          />
          <Button
            title={submitLabel}
            variant="primary"
            size="md"
            icon="arrow-forward"
            iconPosition="right"
            onPress={handleSave}
            style={{ flex: 1.7 }}
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    headerIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.colors.primary}18`,
      marginRight: 10,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 17,
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
