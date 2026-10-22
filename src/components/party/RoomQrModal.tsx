import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { Button } from '../common/Button';
import { copyToClipboard } from '../../utils/clipboard';
import { triggerImpact } from '../../utils/haptics';
import { useToast } from '../common/Toast';

interface RoomQrModalProps {
  visible: boolean;
  onClose: () => void;
  partyCode: string;
  partyTitle: string;
  partyId?: string;
}

export const RoomQrModal: React.FC<RoomQrModalProps> = ({
  visible,
  onClose,
  partyCode,
  partyTitle,
  partyId,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  // Universal deep-link payload
  const qrPayload = useMemo(() => {
    const target = partyCode || partyId || '';
    return `partysplit://join/${target}`;
  }, [partyCode, partyId]);

  const handleCopyCode = async () => {
    void triggerImpact();
    const ok = await copyToClipboard(partyCode);
    if (ok) {
      setCopied(true);
      showToast('Код комнаты скопирован! 📋', { type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Не удалось скопировать код', { type: 'error' });
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="96%"
      height="92%"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        bounces={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="qr-code" size={20} color={theme.colors.neonCyan} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>QR-код комнаты</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {partyTitle || 'Тусовка'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              {partyCode ? (
                <QRCode
                  value={qrPayload}
                  size={220}
                  color="#0B0E14"
                  backgroundColor="#FFFFFF"
                  logoSize={36}
                  logoMargin={4}
                  logoBorderRadius={10}
                  quietZone={14}
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="alert-circle-outline" size={40} color={theme.colors.warning} />
                  <Text style={styles.qrPlaceholderText}>Код комнаты отсутствует</Text>
                </View>
              )}
            </View>
            <Text style={styles.qrHint}>
              Наведите камеру в приложении PartySplit для мгновенного входа
            </Text>
          </View>

          {/* Text Code Block */}
          <View style={styles.codeBlock}>
            <Text style={styles.codeBlockLabel}>КОД ДЛЯ ВХОДА ВРУЧНУЮ</Text>
            <Text style={styles.codeBlockValue} selectable>
              {partyCode || '—'}
            </Text>

            <Button
              title={copied ? 'Скопировано!' : 'Скопировать код'}
              icon={copied ? 'checkmark-circle' : 'copy-outline'}
              variant="primary"
              size="lg"
              onPress={handleCopyCode}
              style={copied ? { ...styles.actionBtn, ...styles.actionBtnCopied } : styles.actionBtn}
            />
          </View>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    scrollView: {
      flex: 1,
      width: '100%',
    },
    scrollContent: {
      paddingBottom: 24,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 2,
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
      backgroundColor: `${theme.colors.neonCyan}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}35`,
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
      fontSize: 13,
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
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
    qrWrapper: {
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.neonCyan,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    qrPlaceholder: {
      width: 220,
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    qrPlaceholderText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    qrHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 14,
      lineHeight: 17,
      paddingHorizontal: 12,
    },
    codeBlock: {
      width: '100%',
      marginTop: 18,
      alignItems: 'center',
    },
    codeBlockLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textMuted,
      letterSpacing: 1.1,
      marginBottom: 6,
    },
    codeBlockValue: {
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 4,
      color: theme.colors.neonCyan,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      marginBottom: 16,
    },
    actionBtn: {
      width: '100%',
    },
    actionBtnCopied: {
      borderColor: theme.colors.success,
    },
  });
}
