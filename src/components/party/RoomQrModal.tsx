import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Share,
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

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  const [sharing, setSharing] = useState(false);
  const svgRef = React.useRef<any>(null);

  // Universal deep-link payload and fallback code
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

  const getQrBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (svgRef.current && typeof svgRef.current.toDataURL === 'function') {
        try {
          svgRef.current.toDataURL((data: string) => {
            if (data && typeof data === 'string' && data.length > 20) {
              resolve(data);
            } else {
              reject(new Error('Invalid base64 from SVG'));
            }
          });
          setTimeout(() => reject(new Error('toDataURL timeout')), 900);
          return;
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('svgRef not ready'));
      }
    });
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    void triggerImpact();

    try {
      const cleanCode = partyCode || 'party';
      const fileUri = `${FileSystem.cacheDirectory}PartySplit_QR_${cleanCode}.png`;

      let hasFile = false;
      try {
        const base64Data = await getQrBase64();
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        hasFile = true;
      } catch {
        // Fallback: download generated QR image via reliable public QR API
        try {
          const encodedPayload = encodeURIComponent(qrPayload);
          const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodedPayload}&margin=16&bgcolor=FFFFFF&color=0B0E14`;
          const dlResult = await FileSystem.downloadAsync(fallbackUrl, fileUri);
          if (dlResult.status === 200) {
            hasFile = true;
          }
        } catch {
          hasFile = false;
        }
      }

      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (hasFile && isSharingAvailable) {
        // Automatically copy the party code to clipboard so user can easily paste it
        if (partyCode) {
          await copyToClipboard(partyCode);
          showToast(`Код ${partyCode} скопирован в буфер! Прикрепляем QR-код...`, {
            type: 'success',
            icon: 'copy-outline',
          });
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: `Код комнаты: ${partyCode || ''}${partyTitle ? ` («${partyTitle}»)` : ''}`,
          UTI: 'public.png',
        });
      } else {
        // Fallback for Web or environments without native file sharing
        const message = `Присоединяйся к тусовке «${partyTitle}» в PartySplit!\nКод комнаты: ${partyCode}`;
        await Share.share({ message });
      }
    } catch {
      showToast('Не удалось поделиться QR-кодом', { type: 'error' });
    } finally {
      setSharing(false);
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
                  getRef={(ref) => {
                    svgRef.current = ref;
                  }}
                  value={qrPayload}
                  size={210}
                  color="#0B0E14"
                  backgroundColor="#FFFFFF"
                  logoSize={34}
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

            <View style={styles.actionsRow}>
              <Button
                title={copied ? 'Скопировано!' : 'Скопировать код'}
                icon={copied ? 'checkmark-circle' : 'copy-outline'}
                variant="outline"
                size="md"
                onPress={handleCopyCode}
                style={copied ? { ...styles.actionBtn, ...styles.actionBtnCopied } : styles.actionBtn}
              />
              <Button
                title={sharing ? 'Подготовка...' : 'Поделиться'}
                icon="share-social-outline"
                variant="primary"
                size="md"
                onPress={handleShare}
                loading={sharing}
                disabled={sharing}
                style={styles.actionBtn}
              />
            </View>
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
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    actionBtn: {
      flex: 1,
    },
    actionBtnCopied: {
      borderColor: theme.colors.success,
    },
  });
}
