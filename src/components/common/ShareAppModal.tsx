import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { useToast } from './Toast';
import { copyToClipboard } from '../../utils/clipboard';
import { triggerImpact } from '../../utils/haptics';

interface ShareAppModalProps {
  visible: boolean;
  onClose: () => void;
  partyCode?: string;
  partyTitle?: string;
}

// Permanent direct download link for the app APK
export const APP_DOWNLOAD_URL =
  'https://drive.google.com/file/d/1Xj-OHVMDlsZKlZfOqkJPza-RSejNJH4M/view?usp=sharing';

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  visible,
  onClose,
  partyCode,
  partyTitle,
}) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    maxHeight="96%"
    height="94%"
  >
    {() => (
      <ShareAppContent
        onClose={onClose}
        partyCode={partyCode}
        partyTitle={partyTitle}
      />
    )}
  </BottomSheetModal>
);

const ShareAppContent: React.FC<Omit<ShareAppModalProps, 'visible'>> = ({
  onClose,
  partyCode,
  partyTitle,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [isQrLoading, setIsQrLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const qrImageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
        APP_DOWNLOAD_URL
      )}&margin=12&bgcolor=FFFFFF&color=0B0E14`,
    []
  );

  const shareText = useMemo(() => {
    let message = `Привет! Скачивай PartySplit (файл APK) для удобного расчёта счетов в компании:\n${APP_DOWNLOAD_URL}`;
    if (partyCode) {
      message += `\n\nКод нашей комнаты: ${partyCode}${
        partyTitle ? ` («${partyTitle}»)` : ''
      }`;
    }
    return message;
  }, [partyCode, partyTitle]);

  const handleCopyLink = async () => {
    void triggerImpact();
    const ok = await copyToClipboard(shareText);
    if (ok) {
      setCopied(true);
      showToast('Ссылка на скачивание скопирована! ✨', {
        type: 'success',
        icon: 'copy-outline',
      });
      setTimeout(() => setCopied(false), 2200);
    } else {
      showToast('Не удалось скопировать', { type: 'error' });
    }
  };

  const handleNativeShare = async () => {
    void triggerImpact();
    try {
      await Share.share({
        message: shareText,
        title: 'Скачать PartySplit APK',
        url: Platform.OS === 'ios' ? APP_DOWNLOAD_URL : undefined,
      });
    } catch {
      // Игнорируем закрытие диалога
    }
  };

  const handleOpenInBrowser = async () => {
    void triggerImpact();
    try {
      const supported = await Linking.canOpenURL(APP_DOWNLOAD_URL);
      if (supported) {
        await Linking.openURL(APP_DOWNLOAD_URL);
      } else {
        showToast('Не удалось открыть ссылку', { type: 'warning' });
      }
    } catch {
      showToast('Не удалось открыть ссылку', { type: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Поделиться приложением</Text>
            <Text style={styles.subtitle}>
              Наведите камеру смартфона для скачивания APK
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max((insets.bottom || 0) + 16, 24) },
        ]}
      >
        {/* QR Code Card */}
        <View style={styles.qrCardWrapper}>
          <View style={styles.qrCard}>
            <Image
              source={{ uri: qrImageUrl }}
              style={styles.qrImage}
              onLoadStart={() => setIsQrLoading(true)}
              onLoadEnd={() => setIsQrLoading(false)}
              resizeMode="contain"
            />
            {isQrLoading && (
              <View style={styles.qrLoadingOverlay}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.qrLoadingText}>Генерация QR-кода...</Text>
              </View>
            )}
          </View>

          <View style={styles.qrBadge}>
            <Ionicons name="logo-android" size={15} color={theme.colors.primary} />
            <Text style={styles.qrBadgeText}>Скачать APK на Google Диске</Text>
          </View>
        </View>

        {/* URL Box */}
        <View style={styles.urlBox}>
          <Ionicons name="logo-google" size={16} color={theme.colors.primary} />
          <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
            {APP_DOWNLOAD_URL}
          </Text>
          <Ionicons name="shield-checkmark" size={15} color={theme.colors.success} />
        </View>

        {/* Room code info (if launched with party) */}
        {partyCode && (
          <View style={styles.roomCodeBanner}>
            <Ionicons name="key-outline" size={17} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roomCodeLabel}>Код текущей комнаты</Text>
              <Text style={styles.roomCodeValue}>{partyCode}</Text>
            </View>
            <Text style={styles.roomCodeHint}>Скопируется в текст</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsBlock}>
          <Button
            title={copied ? 'Скопировано!' : 'Скопировать ссылку'}
            icon={copied ? 'checkmark-circle' : 'copy-outline'}
            variant="primary"
            size="lg"
            onPress={handleCopyLink}
          />

          <View style={styles.secondaryActionsRow}>
            <PressableScale
              style={styles.actionBtn}
              onPress={handleNativeShare}
              accessibilityRole="button"
              accessibilityLabel="Поделиться через меню"
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.actionBtnText}>Поделиться</Text>
            </PressableScale>

            <PressableScale
              style={styles.actionBtn}
              onPress={handleOpenInBrowser}
              accessibilityRole="button"
              accessibilityLabel="Открыть ссылку в браузере"
            >
              <Ionicons
                name="download-outline"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.actionBtnText}>Скачать</Text>
            </PressableScale>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: `${theme.colors.primary}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
      alignItems: 'center',
    },
    qrCardWrapper: {
      alignItems: 'center',
      marginVertical: 10,
    },
    qrCard: {
      width: 250,
      height: 250,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderWidth: 2,
      borderColor: `${theme.colors.primary}40`,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 6,
    },
    qrImage: {
      width: 226,
      height: 226,
      borderRadius: 12,
    },
    qrLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    qrLoadingText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#333333',
    },
    qrBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.primary}14`,
    },
    qrBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    urlBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 6,
      marginBottom: 10,
    },
    urlText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    roomCodeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
    },
    roomCodeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    roomCodeValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: 0.5,
    },
    roomCodeHint: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    actionsBlock: {
      width: '100%',
      gap: 10,
      marginTop: 4,
    },
    secondaryActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
  });
