import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { useToast } from './Toast';
import { copyToClipboard } from '../../utils/clipboard';
import { triggerImpact } from '../../utils/haptics';
import { APP_DOWNLOAD_URL } from '../../config/github';

interface ShareAppModalProps {
  visible: boolean;
  onClose: () => void;
  partyCode?: string;
  partyTitle?: string;
}

// Public GitHub Releases page that always points to the latest APK build.
export { APP_DOWNLOAD_URL };

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  visible,
  onClose,
}) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    height="auto"
    maxHeight="85%"
  >
    <ShareAppContent onClose={onClose} />
  </BottomSheetModal>
);

const ShareAppContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    void triggerImpact();
    const ok = await copyToClipboard(APP_DOWNLOAD_URL);
    if (ok) {
      setCopied(true);
      showToast('Ссылка на скачивание скопирована! 📋', {
        type: 'success',
        icon: 'copy-outline',
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Не удалось скопировать', { type: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="qr-code" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Поделиться приложением</Text>
            <Text style={styles.headerSubtitle}>
              Отсканируйте QR-код или скопируйте ссылку
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* QR Code */}
      <View style={styles.qrCard}>
        <View style={styles.qrWrapper}>
          <QRCode
            value={APP_DOWNLOAD_URL}
            size={220}
            color="#0B0E14"
            backgroundColor="#FFFFFF"
            logoSize={36}
            logoMargin={4}
            logoBorderRadius={10}
            quietZone={14}
          />
        </View>
      </View>

      {/* URL Box */}
      <View style={styles.urlBox}>
        <Ionicons name="link-outline" size={17} color={theme.colors.primary} />
        <Text
          style={styles.urlText}
          numberOfLines={1}
          ellipsizeMode="middle"
          selectable
        >
          {APP_DOWNLOAD_URL}
        </Text>
      </View>

      {/* Copy Button */}
      <Button
        title={copied ? 'Скопировано!' : 'Скопировать ссылку'}
        icon={copied ? 'checkmark-circle' : 'copy-outline'}
        variant="primary"
        size="lg"
        onPress={handleCopyLink}
        style={styles.copyBtn}
      />
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 2,
      paddingBottom: 24,
      alignItems: 'center',
    },
    header: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.surfaceBorder}60`,
      marginBottom: 18,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}35`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${theme.colors.surfaceBorder}60`,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    qrCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 5,
      marginBottom: 16,
    },
    qrWrapper: {
      backgroundColor: '#FFFFFF',
      padding: 14,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    urlBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    urlText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    copyBtn: {
      width: '100%',
    },
  });
}
