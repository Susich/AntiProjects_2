import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../common/BottomSheetModal';

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

  // Universal deep-link payload
  const qrPayload = useMemo(() => {
    const target = partyCode || partyId || '';
    return `partysplit://join/${target}`;
  }, [partyCode, partyId]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="auto"
      maxHeight="85%"
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
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
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
                size={230}
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
      </View>
    </BottomSheetModal>
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
      marginBottom: 20,
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
      width: 230,
      height: 230,
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
      marginTop: 16,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
  });
}
