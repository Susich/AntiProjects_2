import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { Button } from '../common/Button';
import { triggerImpact } from '../../utils/haptics';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

/**
 * Extracts room code or partyId from various formats:
 * - partysplit://join/ROOM42
 * - https://partysplit.app/join/ROOM42
 * - ROOM42 or party_17926982...
 */
export function parseJoinCodeFromQr(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Custom deep link: partysplit://join/{code}
  const deepLinkMatch = trimmed.match(/partysplit:\/\/join\/([^/?#]+)/i);
  if (deepLinkMatch && deepLinkMatch[1]) {
    return deepLinkMatch[1].trim();
  }

  // Web deep link: https://.../join/{code}
  const webMatch = trimmed.match(/\/join\/([^/?#]+)/i);
  if (webMatch && webMatch[1]) {
    return webMatch[1].trim();
  }

  return trimmed;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onScan,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <QrScannerContent onClose={onClose} onScan={onScan} />
    </Modal>
  );
};

const QrScannerContent: React.FC<Omit<QrScannerModalProps, 'visible'>> = ({
  onClose,
  onScan,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScanned) return;
    const rawData = result.data;
    const extractedCode = parseJoinCodeFromQr(rawData);

    if (extractedCode) {
      setHasScanned(true);
      void triggerImpact();
      onScan(extractedCode);
      onClose();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Закрыть сканер"
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Сканирование QR-кода</Text>

        <TouchableOpacity
          style={[styles.circleBtn, torchEnabled && styles.circleBtnActive]}
          onPress={() => setTorchEnabled((prev) => !prev)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Вспышка"
        >
          <Ionicons
            name={torchEnabled ? 'flash' : 'flash-outline'}
            size={20}
            color={torchEnabled ? theme.colors.neonCyan : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Content based on permission */}
      {!permission ? (
        <View style={styles.centerBox}>
          <Text style={styles.statusText}>Проверка разрешений...</Text>
        </View>
      ) : !permission.granted ? (
        <View style={styles.permissionBox}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera-outline" size={44} color={theme.colors.neonCyan} />
          </View>
          <Text style={styles.permissionTitle}>Требуется доступ к камере</Text>
          <Text style={styles.permissionDesc}>
            Камера используется исключительно для мгновенного сканирования QR-кода тусовки без ручного ввода.
          </Text>
          <Button
            title="Разрешить доступ к камере"
            icon="camera"
            variant="primary"
            size="lg"
            onPress={() => void requestPermission()}
            style={styles.permissionBtn}
          />
        </View>
      ) : (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.cameraFill}
            facing="back"
            enableTorch={torchEnabled}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
          />

          {/* Dark mask overlay around viewport */}
          <View style={styles.maskContainer}>
            <View style={styles.maskTop} />
            <View style={styles.maskMiddle}>
              <View style={styles.maskSide} />
              <View style={styles.targetBox}>
                {/* Neon Corner Markers */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.maskSide} />
            </View>
            <View style={styles.maskBottom}>
              <Text style={styles.instructionText}>
                Наведите камеру на QR-код тусовки
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    cameraFill: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    topBar: {
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleBtnActive: {
      backgroundColor: 'rgba(0, 245, 160, 0.25)',
      borderWidth: 1,
      borderColor: theme.colors.neonCyan,
    },
    cameraWrapper: {
      flex: 1,
      position: 'relative',
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 15,
    },
    permissionBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      backgroundColor: theme.colors.background,
    },
    permissionIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: `${theme.colors.neonCyan}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}40`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    permissionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    permissionDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 26,
    },
    permissionBtn: {
      width: '100%',
    },
    maskContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    maskTop: {
      flex: 0.7,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    maskMiddle: {
      flexDirection: 'row',
      height: 260,
    },
    maskSide: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    targetBox: {
      width: 260,
      height: 260,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: theme.colors.neonCyan,
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 10,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 10,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 10,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 10,
    },
    maskBottom: {
      flex: 1.4,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      alignItems: 'center',
      paddingTop: 32,
    },
    instructionText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
      textAlign: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 18,
      overflow: 'hidden',
    },
  });
}
