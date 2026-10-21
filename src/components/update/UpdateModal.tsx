import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useToast } from '../common/Toast';
import {
  CURRENT_APP_VERSION,
  downloadAndInstallApk,
  markVersionAsInstalled,
  openUnknownAppSourcesPermission,
  UpdateCheckResult,
} from '../../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckResult | null;
  onVersionUpdated?: (version: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  onClose,
  updateInfo,
  onVersionUpdated,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [manuallyConfirmed, setManuallyConfirmed] = useState(false);

  const currentVersion = updateInfo?.currentVersion || CURRENT_APP_VERSION;
  const targetVersion = updateInfo?.latestVersion || CURRENT_APP_VERSION;
  const hasUpdate = !manuallyConfirmed && (updateInfo?.hasUpdate ?? false);
  const releaseNotes =
    updateInfo?.releaseNotes ||
    '• Стабильная доставка системных уведомлений в Android 13+\n• Обновлённое отображение модальных окон и таб-бара\n• Быстрая синхронизация счетов через Google Диск';
  const sizeMb = updateInfo?.fileSizeMb || 42;

  const handleStartUpdate = async () => {
    if (!updateInfo?.apkUrl) {
      showToast('Ссылка на обновление не найдена', { type: 'error' });
      return;
    }

    setDownloadError(null);
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const res = await downloadAndInstallApk(
        updateInfo.apkUrl,
        (progress, written, total) => {
          setDownloadProgress(progress);
          setDownloadedBytes(written);
          setTotalBytes(total);
        },
        targetVersion
      );

      if (res.success) {
        setIsReadyToInstall(true);
        setIsDownloading(false);
        await markVersionAsInstalled(targetVersion);
        onVersionUpdated?.(targetVersion);
        showToast('Файл готов к установке! ✨', { type: 'success' });
      } else {
        setIsDownloading(false);
        setDownloadError(res.error || 'Ошибка при установке файла');
        showToast('Не удалось установить APK', { type: 'error' });
      }
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadError(err?.message || 'Ошибка загрузки обновления');
      showToast('Ошибка загрузки обновления', { type: 'error' });
    }
  };

  const handleMarkAsInstalled = async () => {
    try {
      await markVersionAsInstalled(targetVersion);
      setManuallyConfirmed(true);
      onVersionUpdated?.(targetVersion);
      showToast(`Версия v${targetVersion} подтверждена как актуальная! ✨`, {
        type: 'success',
      });
    } catch {
      showToast('Не удалось обновить статус версии', { type: 'error' });
    }
  };

  const progressPercent = Math.min(Math.round(downloadProgress * 100), 100);
  const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : sizeMb.toString();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={isDownloading ? () => {} : onClose}
      maxHeight="92%"
      height="84%"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              !hasUpdate && {
                backgroundColor: `${theme.colors.success}18`,
                borderColor: `${theme.colors.success}40`,
              },
            ]}
          >
            <Ionicons
              name={hasUpdate ? 'sparkles' : 'checkmark-circle'}
              size={28}
              color={hasUpdate ? theme.colors.primary : theme.colors.success}
            />
          </View>
          <Text style={styles.title}>
            {hasUpdate ? 'Доступно обновление!' : 'У вас актуальная версия ✨'}
          </Text>

          {hasUpdate ? (
            <View style={styles.versionRow}>
              <View style={styles.versionBadgeCurrent}>
                <Text style={styles.versionTextCurrent}>Текущая: v{currentVersion}</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.textMuted} />
              <View style={styles.versionBadgeNew}>
                <Text style={styles.versionTextNew}>Новая: v{targetVersion}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.versionBadgeCurrentSuccess}>
              <Ionicons name="checkmark-done" size={15} color={theme.colors.success} />
              <Text style={styles.versionTextCurrentSuccess}>
                v{targetVersion} · Самая свежая версия
              </Text>
            </View>
          )}
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name={hasUpdate ? 'newspaper-outline' : 'shield-checkmark-outline'}
              size={17}
              color={hasUpdate ? theme.colors.primary : theme.colors.success}
            />
            <Text style={styles.cardTitle}>
              {hasUpdate ? 'Что нового в этой версии' : 'Система в актуальном состоянии'}
            </Text>
            <View style={styles.sizePill}>
              <Text style={styles.sizePillText}>~{sizeMb} МБ</Text>
            </View>
          </View>
          <Text style={styles.notesText}>
            {hasUpdate
              ? releaseNotes
              : 'Вы используете последнюю версию PartySplit. Все функции, синхронизация расходов с Google Sheets и системные уведомления работают в штатном режиме.'}
          </Text>
        </Card>

        {isDownloading && (
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressStatusText}>
                Загрузка APK с Google Диска...
              </Text>
              <Text style={styles.progressPercentText}>{progressPercent}%</Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(progressPercent, 4)}%` },
                ]}
              />
            </View>

            <View style={styles.progressFooter}>
              <Text style={styles.progressBytesText}>
                {downloadedMb} МБ из {totalMb} МБ
              </Text>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          </Card>
        )}

        {downloadError && (
          <View style={styles.errorBox}>
            <View style={styles.errorHeader}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.errorTitle}>Не удалось установить автоматически</Text>
            </View>
            <Text style={styles.errorText}>{downloadError}</Text>

            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.unknownSourcesButton}
                onPress={() => void openUnknownAppSourcesPermission()}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
                <Text style={styles.unknownSourcesText}>
                  Разрешить установку неизвестных приложений
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.helpBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.helpText}>
            Файл скачивается напрямую из защищённого облака Google Диска. При первом
            обновлении Android может запросить разрешение на установку для PartySplit.
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {hasUpdate ? (
            <>
              <Button
                title={
                  isDownloading
                    ? `Скачивание (${progressPercent}%)...`
                    : isReadyToInstall
                    ? 'Установить обновление'
                    : 'Обновить сейчас'
                }
                onPress={handleStartUpdate}
                loading={isDownloading}
                disabled={isDownloading}
                icon="cloud-download-outline"
                style={styles.updateButton}
              />

              {!isDownloading && (
                <TouchableOpacity
                  style={styles.alreadyInstalledButton}
                  onPress={handleMarkAsInstalled}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={17}
                    color={theme.colors.success}
                  />
                  <Text style={styles.alreadyInstalledText}>
                    Я уже установил эту версию (v{targetVersion})
                  </Text>
                </TouchableOpacity>
              )}

              {!isDownloading && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Напомнить позже</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Button
                title="Отлично, закрыть"
                onPress={onClose}
                icon="checkmark-circle-outline"
                style={styles.updateButton}
              />

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleStartUpdate}
                disabled={isDownloading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>
                  {isDownloading
                    ? `Скачивание (${progressPercent}%)...`
                    : 'Переустановить APK повторно'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 4,
    },
    iconCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1.5,
      borderColor: `${theme.colors.primary}40`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    versionBadgeNew: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    versionTextNew: {
      color: theme.colors.textInverse,
      fontSize: 13,
      fontWeight: '700',
    },
    versionBadgeCurrent: {
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    versionTextCurrent: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    versionBadgeCurrentSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: `${theme.colors.success}16`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}35`,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      marginTop: 8,
    },
    versionTextCurrentSuccess: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: '700',
    },
    alreadyInstalledButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: `${theme.colors.success}14`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}35`,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
    },
    alreadyInstalledText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.success,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginLeft: 6,
    },
    sizePill: {
      backgroundColor: theme.colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    sizePillText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    notesText: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    progressCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
      padding: theme.spacing.md,
      gap: 8,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressStatusText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    progressPercentText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    progressBarTrack: {
      height: 8,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 4,
      overflow: 'hidden',
      marginVertical: 4,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressBytesText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    errorBox: {
      backgroundColor: `${theme.colors.danger}15`,
      borderColor: `${theme.colors.danger}40`,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    errorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    errorTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.danger,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    unknownSourcesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: `${theme.colors.primary}18`,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginTop: 4,
    },
    unknownSourcesText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    helpBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: theme.colors.surfaceElevated,
      padding: 10,
      borderRadius: 10,
    },
    helpText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textMuted,
    },
    actionButtons: {
      gap: 8,
      marginTop: 6,
    },
    updateButton: {
      width: '100%',
    },
    cancelButton: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
  });
}
