import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
  LatestReleaseInfo,
  checkForUpdate,
  downloadAndInstallApk,
  openUnknownAppSourcesPermission,
} from '../../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

type CheckState = 'idle' | 'checking' | 'update' | 'latest' | 'error';

function formatReleaseNotes(body: string): string {
  return String(body || '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim();
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Checks GitHub Releases (semver) and, when a newer version exists, downloads
 * the attached APK and opens the Android package installer.
 */
export const UpdateModal: React.FC<UpdateModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();

  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [release, setRelease] = useState<LatestReleaseInfo | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const requestRef = useRef(0);

  const runCheck = useCallback(async () => {
    const requestId = ++requestRef.current;
    setCheckState('checking');
    setCheckError(null);
    setDownloadError(null);
    setRelease(null);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    const result = await checkForUpdate();
    if (requestId !== requestRef.current) return;

    if (result.status === 'error') {
      setCheckState('error');
      setCheckError(result.error);
      return;
    }

    setRelease(result.latest);
    setCheckState(result.status);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Defer the state-changing check so opening the sheet stays a pure render
    // pass (React lint rule: no synchronous setState inside an effect).
    const timer = setTimeout(() => {
      void runCheck();
    }, 0);

    return () => {
      clearTimeout(timer);
      // Ignore a response that arrives after the modal was closed.
      requestRef.current += 1;
    };
  }, [visible, runCheck]);

  const handleDownload = async () => {
    if (!release) return;

    setDownloadError(null);
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(release.apkSize > 0 ? release.apkSize : 0);

    try {
      const res = await downloadAndInstallApk(
        release.apkUrl,
        (progress, written, total) => {
          setDownloadProgress(progress);
          setDownloadedBytes(written);
          setTotalBytes(total);
        },
        release.apkName
      );

      if (res.success) {
        setIsDownloading(false);
        showToast('APK загружен, установка запущена! ✨', { type: 'success' });
        onClose();
      } else {
        setIsDownloading(false);
        setDownloadError(res.error || 'Ошибка при установке файла');
        showToast('Не удалось скачать APK', { type: 'error' });
      }
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadError(err?.message || 'Ошибка загрузки файла');
      showToast('Ошибка загрузки файла', { type: 'error' });
    }
  };

  const progressPercent = Math.min(Math.round(downloadProgress * 100), 100);
  const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
  const notes = release ? formatReleaseNotes(release.notes) : '';
  const publishedLabel = release ? formatDate(release.publishedAt) : '';
  const apkSizeLabel = release ? formatSize(release.apkSize) : '';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={isDownloading ? () => {} : onClose}
      maxHeight="92%"
      height="78%"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={checkState === 'latest' ? 'checkmark-done-circle' : 'cloud-download'}
              size={28}
              color={checkState === 'latest' ? theme.colors.success : theme.colors.primary}
            />
          </View>
          <Text style={styles.title}>Обновление приложения</Text>
          <View style={styles.versionBadge}>
            <Ionicons name="phone-portrait-outline" size={14} color={theme.colors.success} />
            <Text style={styles.versionBadgeText}>
              Текущая версия: v{CURRENT_APP_VERSION}
            </Text>
          </View>
        </View>

        {checkState === 'checking' && (
          <Card style={styles.statusCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.statusText}>Проверяем обновления на GitHub...</Text>
          </Card>
        )}

        {checkState === 'error' && (
          <View style={styles.errorBox}>
            <View style={styles.errorHeader}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.errorTitle}>Не удалось проверить обновления</Text>
            </View>
            <Text style={styles.errorText}>{checkError}</Text>
            <Button
              title="Проверить снова"
              variant="secondary"
              size="md"
              icon="refresh"
              onPress={() => void runCheck()}
              style={styles.retryButton}
            />
          </View>
        )}

        {checkState === 'latest' && release && (
          <Card style={styles.latestCard}>
            <View style={styles.latestIconRow}>
              <Ionicons
                name="checkmark-circle"
                size={30}
                color={theme.colors.success}
              />
            </View>
            <Text style={styles.latestTitle}>У вас установлена последняя версия</Text>
            <Text style={styles.latestSubtitle}>
              Текущая v{CURRENT_APP_VERSION} · последняя на GitHub v{release.version}
            </Text>
          </Card>
        )}

        {checkState === 'update' && release && (
          <>
            <Card style={styles.releaseCard}>
              <View style={styles.releaseTopRow}>
                <View style={styles.releaseTitleBlock}>
                  <Text style={styles.releaseLabel}>Доступна новая версия</Text>
                  <Text style={styles.releaseVersion}>v{release.version}</Text>
                </View>
                {apkSizeLabel ? (
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeBadgeText}>{apkSizeLabel}</Text>
                  </View>
                ) : null}
              </View>

              {release.releaseName ? (
                <Text style={styles.releaseName}>{release.releaseName}</Text>
              ) : null}

              {publishedLabel ? (
                <Text style={styles.releaseDate}>Опубликовано {publishedLabel}</Text>
              ) : null}

              <View style={styles.notesDivider} />
              <Text style={styles.notesTitle}>Что нового</Text>
              <Text style={notes ? styles.notesText : styles.notesEmpty} selectable>
                {notes || 'Описание изменений не указано.'}
              </Text>
            </Card>

            {!isDownloading && (
              <>
                <Button
                  title="Обновить"
                  onPress={() => void handleDownload()}
                  icon="cloud-download-outline"
                  style={styles.updateButton}
                />

                {downloadError ? (
                  <View style={styles.errorBox}>
                    <View style={styles.errorHeader}>
                      <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
                      <Text style={styles.errorTitle}>Не удалось скачать или установить</Text>
                    </View>
                    <Text style={styles.errorText}>{downloadError}</Text>

                    {Platform.OS === 'android' && (
                      <TouchableOpacity
                        style={styles.unknownSourcesButton}
                        onPress={() => void openUnknownAppSourcesPermission()}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.unknownSourcesText}>
                          Разрешить установку неизвестных приложений
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </>
            )}
          </>
        )}

        {isDownloading && release && (
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressStatusText}>Скачивание APK с GitHub...</Text>
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
                {totalBytes > 0 ? `${downloadedMb} МБ из ${totalMb} МБ` : 'Подготовка...'}
              </Text>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          </Card>
        )}

        {release?.releaseUrl && checkState === 'update' && !isDownloading ? (
          <TouchableOpacity
            style={styles.githubLink}
            onPress={() => void Linking.openURL(release.releaseUrl)}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-github" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.githubLinkText}>Открыть релиз на GitHub</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.footerNote}>
          Обновления проверяются через GitHub Releases. APK скачивается напрямую из
          прикреплённого файла релиза и открывается в установщике Android.
        </Text>
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
    versionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      backgroundColor: `${theme.colors.success}16`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}35`,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
    },
    versionBadgeText: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: '700',
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      padding: theme.spacing.md,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    latestCard: {
      alignItems: 'center',
      backgroundColor: `${theme.colors.success}10`,
      borderColor: `${theme.colors.success}45`,
      padding: theme.spacing.lg,
      gap: 6,
    },
    latestIconRow: {
      marginBottom: 2,
    },
    latestTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    latestSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    releaseCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
      padding: theme.spacing.md,
      gap: 6,
    },
    releaseTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    releaseTitleBlock: {
      flex: 1,
    },
    releaseLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
    releaseVersion: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: -0.4,
    },
    sizeBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: `${theme.colors.primary}16`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}35`,
    },
    sizeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    releaseName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    releaseDate: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    notesDivider: {
      height: 1,
      backgroundColor: theme.colors.surfaceBorder,
      marginVertical: 6,
    },
    notesTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    notesText: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    notesEmpty: {
      fontSize: 12,
      lineHeight: 18,
      fontStyle: 'italic',
      color: theme.colors.textMuted,
    },
    updateButton: {
      width: '100%',
    },
    retryButton: {
      width: '100%',
      marginTop: 6,
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
    githubLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    githubLinkText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    footerNote: {
      fontSize: 11,
      lineHeight: 16,
      textAlign: 'center',
      color: theme.colors.textMuted,
    },
  });
}
