import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePartyStore } from '../../store/usePartyStore';
import { useTheme } from '../../context/ThemeContext';
import {
  getGoogleScriptUrl,
  setGoogleScriptUrl,
  testGoogleScriptConnection,
  createPartyInCloud,
  joinPartyInCloud,
  syncPartyMembersInCloud,
  addExpenseToCloud,
} from '../../api/googleSheets';
import { ParticipantProfile } from '../../types';
import { mergeCloudParty, mergeUniqueIds, toCloudMember } from '../../utils/cloudSync';
import { cleanPhone } from '../../utils/currency';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { IdentityGateForm } from '../profile/IdentityGateModal';
import { copyToClipboard } from '../../utils/deepLinks';
import { useToast } from '../common/Toast';

interface CloudSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

type CloudTab = 'room' | 'join' | 'settings';

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  visible,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? <CloudSyncContent onClose={onClose} /> : null}
  </Modal>
);

const CloudSyncContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const currentParty = usePartyStore((s) => s.currentParty);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const myProfileId = usePartyStore((s) => s.myProfileId);
  const addProfile = usePartyStore((s) => s.addProfile);
  const updateProfile = usePartyStore((s) => s.updateProfile);
  const setMyProfile = usePartyStore((s) => s.setMyProfile);
  const addParticipantToParty = usePartyStore((s) => s.addParticipantToParty);
  const syncPartyFromCloud = usePartyStore((s) => s.syncPartyFromCloud);
  const syncWithCloud = usePartyStore((s) => s.syncWithCloud);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<CloudTab>('room');
  const [scriptUrl, setScriptUrlInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isIdentityGateVisible, setIsIdentityGateVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(
    null
  );

  const myProfile =
    savedProfiles.find((profile) => profile.id === myProfileId) || null;
  const myProfileIsComplete = Boolean(
    myProfile?.name.trim() && cleanPhone(myProfile?.paymentInfo?.phone).length >= 10
  );

  // The modal body is mounted on every open, so local state (test result,
  // room code input) already starts clean. Only async URL loading is needed.
  useEffect(() => {
    let cancelled = false;
    getGoogleScriptUrl().then((url) => {
      if (cancelled) return;
      setScriptUrlInput(url);
      if (!url) {
        setActiveTab('settings');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save URL and Test Ping
  const handleSaveAndTestUrl = async () => {
    const trimmed = scriptUrl.trim();
    if (!trimmed) {
      showToast('Введите URL Google Apps Script', { type: 'warning' });
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    await setGoogleScriptUrl(trimmed);

    const res = await testGoogleScriptConnection(trimmed);
    setIsLoading(false);
    setTestResult(res);

    if (res.success) {
      showToast('Связь с Google Sheets установлена!', { type: 'success' });
    } else {
      showToast('Ошибка подключения', { type: 'error' });
    }
  };

  // Every create/join starts with the identity gate. The name and phone become
  // the member's shared SBP requisites; the room never has anonymous members.
  const handleRequestCreateRoom = async () => {
    const url = await getGoogleScriptUrl();
    if (!url) {
      showToast('Сначала настройте URL Google Apps Script', { type: 'warning' });
      setActiveTab('settings');
      return;
    }

    setPendingAction('create');
    setIsIdentityGateVisible(true);
  };

  const handleRequestJoinRoom = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) {
      showToast('Введите 6-значный код комнаты', { type: 'warning' });
      return;
    }

    const url = await getGoogleScriptUrl();
    if (!url) {
      showToast('Сначала настройте URL Google Apps Script', { type: 'warning' });
      setActiveTab('settings');
      return;
    }

    setPendingAction('join');
    setIsIdentityGateVisible(true);
  };

  const handleIdentitySave = (data: Omit<ParticipantProfile, 'id'>) => {
    let self: ParticipantProfile;

    if (myProfile) {
      self = {
        ...myProfile,
        ...data,
        paymentInfo: { ...data.paymentInfo },
      };
      updateProfile(myProfile.id, data);
      setMyProfile(myProfile.id);
    } else {
      self = addProfile(data);
      setMyProfile(self.id);
    }

    const action = pendingAction;
    const code = roomCodeInput.trim().toUpperCase();
    setPendingAction(null);
    setIsIdentityGateVisible(false);

    if (action === 'create') {
      addParticipantToParty(self.id);
      void performCreateRoom(self);
    } else if (action === 'join') {
      void performJoinRoom(self, code);
    }
  };

  const handleIdentityCancel = () => {
    setIsIdentityGateVisible(false);
    setPendingAction(null);
  };

  // Create Cloud Room
  const performCreateRoom = async (user: ParticipantProfile) => {
    // Read fresh state: the identity gate may have just added the user.
    const state = usePartyStore.getState();
    const latestParty = state.currentParty;
    const latestProfiles = state.savedProfiles;

    setIsLoading(true);
    const res = await createPartyInCloud(latestParty.title || 'Тусовка', user);

    if (!res.success || !res.party) {
      setIsLoading(false);
      Alert.alert(
        'Ошибка создания комнаты',
        res.error || 'Проверьте URL скрипта и права доступа'
      );
      return;
    }

    const { id: partyId, code, title } = res.party;

    // Push every local participant profile and every local expense BEFORE the
    // cloud becomes the source of truth, keeping the same expense ids so
    // edits/deletes match on all devices afterwards.
    const memberProfiles = (latestParty.participants || [])
      .map((participantId) => latestProfiles.find((p) => p.id === participantId))
      .filter(Boolean) as ParticipantProfile[];
    let serverOutdated = false;
    if (memberProfiles.length > 0) {
      const membersRes = await syncPartyMembersInCloud(
        partyId,
        memberProfiles.map(toCloudMember)
      );
      if (!membersRes.success && /старой версии/i.test(membersRes.error || '')) {
        serverOutdated = true;
      }
    }
    for (const expense of latestParty.expenses || []) {
      await addExpenseToCloud(partyId, {
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        paidById: expense.paidById,
        sharedUserIds: (expense.splitBetween || []).map((s) => s.userId),
        category: expense.category,
      });
    }

    // Remember the room locally right away, keeping local participants and
    // expenses visible until the confirmatory sync below finishes.
    const created = mergeCloudParty(latestParty, res);
    if (created) {
      syncPartyFromCloud(
        {
          ...created.party,
          id: partyId,
          code,
          title,
          participants: mergeUniqueIds(
            latestParty.participants,
            created.party.participants
          ),
          expenses: latestParty.expenses,
          // If a push above failed, keep those cheques tracked so the next
          // background sync uploads them again instead of losing them.
          pendingExpenseIds: (latestParty.expenses || []).map((expense) => expense.id),
        },
        created.profiles
      );
    }

    // Re-read the sheet: it is the shared source of truth from now on.
    const sync = await syncWithCloud();
    setIsLoading(false);
    setActiveTab('room');

    if (sync.success) {
      showToast(`Комната создана! Код: ${code}`, { type: 'success' });
    } else {
      showToast(`Комната создана (код ${code}), но данные не догрузились`, {
        type: 'warning',
      });
    }

    if (serverOutdated) {
      Alert.alert(
        'Обновите серверную часть',
        'Комната создана, но Google Apps Script ещё старой версии: участники и изменения чеков не будут синхронизироваться. Скопируйте актуальный backend/Code.gs в редактор Apps Script и сделайте новое развёртывание (Deploy → Manage deployments → Edit → New version).'
      );
    }
  };

  // Join Existing Room by Code
  const performJoinRoom = async (user: ParticipantProfile, code: string) => {
    setIsLoading(true);
    const res = await joinPartyInCloud(code, user);

    if (res.success && res.party) {
      // The server response already contains the actual member list.
      const latestParty = usePartyStore.getState().currentParty;
      const merged = mergeCloudParty(latestParty, res);
      if (merged) {
        syncPartyFromCloud(
          {
            ...merged.party,
            participants: mergeUniqueIds(merged.party.participants, [user.id]),
          },
          merged.profiles
        );
      }
      setIsLoading(false);

      showToast(`Вы присоединились к тусовке «${res.party.title}»!`, {
        type: 'success',
      });
      onClose();
    } else {
      setIsLoading(false);
      Alert.alert(
        'Не удалось подключиться к комнате',
        res.error || 'Проверьте правильность кода'
      );
    }
  };

  // Sync Party from Cloud
  const handleSyncCurrentParty = async () => {
    if (!currentParty.code) {
      showToast('Комната ещё не создана в облаке', { type: 'info' });
      return;
    }

    setIsLoading(true);
    const res = await syncWithCloud();
    setIsLoading(false);

    if (res.success) {
      showToast('Данные синхронизированы с Google Sheets!', {
        type: 'success',
      });
    } else {
      showToast(res.error || 'Ошибка синхронизации', { type: 'error' });
    }
  };

  // Copy Room Code
  const handleCopyCode = async () => {
    if (currentParty.code) {
      await copyToClipboard(currentParty.code);
      showToast(`Код ${currentParty.code} скопирован в буфер!`, {
        type: 'success',
      });
    }
  };

  return (
    <View
        style={[
          styles.overlay,
          {
            backgroundColor: theme.colors.overlay,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.surfaceBorderActive,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.headerIconCircle,
                  { backgroundColor: `${theme.colors.neonCyan}20` },
                ]}
              >
                <Ionicons
                  name="cloud-done-outline"
                  size={20}
                  color={theme.colors.neonCyan}
                />
              </View>
              <View>
                <Text
                  style={[styles.modalTitle, { color: theme.colors.textPrimary }]}
                >
                  Google Sheets Cloud
                </Text>
                <Text
                  style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}
                >
                  Совместный доступ и синхронизация тусовки
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={[styles.tabsRow, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('room')}
              style={[
                styles.tabBtn,
                activeTab === 'room' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color:
                      activeTab === 'room'
                        ? theme.colors.textInverse
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                Комната
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('join')}
              style={[
                styles.tabBtn,
                activeTab === 'join' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color:
                      activeTab === 'join'
                        ? theme.colors.textInverse
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                Войти по коду
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={[
                styles.tabBtn,
                activeTab === 'settings' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color:
                      activeTab === 'settings'
                        ? theme.colors.textInverse
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                Настройки URL
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* TAB 1: CURRENT ROOM */}
            {activeTab === 'room' && (
              <View style={styles.tabContent}>
                {currentParty.code ? (
                  <View
                    style={[
                      styles.codeBanner,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.neonCyan,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.codeBannerLabel,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      КОД ДЛЯ ДРУЗЕЙ В ТУСОВКЕ
                    </Text>
                    <View style={styles.codeRow}>
                      <Text
                        style={[
                          styles.codeBannerText,
                          { color: theme.colors.neonCyan },
                        ]}
                      >
                        {currentParty.code}
                      </Text>
                      <TouchableOpacity
                        onPress={handleCopyCode}
                        style={[
                          styles.copyCodeBtn,
                          { backgroundColor: `${theme.colors.neonCyan}25` },
                        ]}
                      >
                        <Ionicons
                          name="copy-outline"
                          size={18}
                          color={theme.colors.neonCyan}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[
                        styles.codeBannerHint,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Отправьте этот код друзьям, чтобы они открыли приложение и самостоятельно вносили свои счета. Данные обновляются автоматически каждые 10 секунд.
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.noCodeBox,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={36}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.noCodeTitle,
                        { color: theme.colors.textPrimary },
                      ]}
                    >
                      Комната ещё не создана
                    </Text>
                    <Text
                      style={[
                        styles.noCodeSubtitle,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      Создайте облачную комнату в вашей Google Таблице, чтобы каждый участник мог в реальном времени добавлять расходы
                    </Text>
                    <Button
                      title="Создать комнату в Google Sheets"
                      variant="primary"
                      size="md"
                      icon="cloud-upload-outline"
                      onPress={handleRequestCreateRoom}
                      loading={isLoading}
                      style={{ marginTop: 14 }}
                    />
                  </View>
                )}

                {currentParty.code && (
                  <View style={{ marginTop: 14 }}>
                    <Button
                      title="Синхронизировать сейчас"
                      variant="secondary"
                      size="md"
                      icon="refresh-outline"
                      onPress={handleSyncCurrentParty}
                      loading={isLoading}
                    />
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: JOIN BY CODE */}
            {activeTab === 'join' && (
              <View style={styles.tabContent}>
                <Text
                  style={[
                    styles.formLabel,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  Введите 6-значный код тусовки
                </Text>
                <Input
                  value={roomCodeInput}
                  onChangeText={(val) => setRoomCodeInput(val.toUpperCase())}
                  placeholder="Например: PUB777, BAR404"
                  autoCapitalize="characters"
                  maxLength={8}
                  containerStyle={{ marginBottom: 12 }}
                />
                <Button
                  title="Подключиться к тусовке"
                  variant="primary"
                  size="md"
                  icon="enter-outline"
                  onPress={handleRequestJoinRoom}
                  loading={isLoading}
                  disabled={roomCodeInput.trim().length < 4}
                />
                <Text
                  style={[
                    styles.joinHelpText,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {myProfileIsComplete
                    ? 'Перед входом проверим ваши имя и телефон — их увидят участники комнаты.'
                    : 'Перед входом попросим имя и телефон: без них участники не смогут перевести вам долг по СБП.'}
                  {'\n'}После подключения загрузятся участники, счета и актуальный баланс.
                </Text>
              </View>
            )}

            {/* TAB 3: SETTINGS URL */}
            {activeTab === 'settings' && (
              <View style={styles.tabContent}>
                <Text
                  style={[
                    styles.formLabel,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  URL веб-приложения Google Apps Script
                </Text>
                <Input
                  value={scriptUrl}
                  onChangeText={setScriptUrlInput}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  autoCapitalize="none"
                  autoCorrect={false}
                  containerStyle={{ marginBottom: 12 }}
                />

                <Button
                  title="Сохранить и проверить связь"
                  variant="primary"
                  size="md"
                  icon="checkmark-circle-outline"
                  onPress={handleSaveAndTestUrl}
                  loading={isLoading}
                />

                {testResult && (
                  <View
                    style={[
                      styles.testResultBox,
                      {
                        backgroundColor: testResult.success
                          ? `${theme.colors.success}26`
                          : `${theme.colors.danger}26`,
                        borderColor: testResult.success
                          ? theme.colors.success
                          : theme.colors.danger,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        testResult.success
                          ? 'checkmark-circle'
                          : 'alert-circle'
                      }
                      size={18}
                      color={
                        testResult.success
                          ? theme.colors.success
                          : theme.colors.danger
                      }
                    />
                    <Text
                      style={[
                        styles.testResultText,
                        {
                          color: testResult.success
                            ? theme.colors.success
                            : theme.colors.danger,
                        },
                      ]}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                )}

                {/* Quick Deployment Guide Accordion */}
                <TouchableOpacity
                  onPress={() => setShowGuide(!showGuide)}
                  style={[
                    styles.guideToggleRow,
                    { borderColor: theme.colors.surfaceBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.guideToggleText,
                      { color: theme.colors.neonCyan },
                    ]}
                  >
                    Инструкция по развёртыванию бэкенда
                  </Text>
                  <Ionicons
                    name={showGuide ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.neonCyan}
                  />
                </TouchableOpacity>

                {showGuide && (
                  <View
                    style={[
                      styles.guideContentBox,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.guideStepText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      1. Откройте Google Таблицу на Google Диске.{'\n'}
                      2. Меню: Расширения ➔ Apps Script.{'\n'}
                      3. Скопируйте код из файла backend/Code.gs репозитория.{'\n'}
                      4. Нажмите «Развернуть» ➔ «Новое развертывание» ➔ тип «Веб-приложение».{'\n'}
                      5. Укажите: Выполнять от «Меня», Доступ: «Все» (Anyone).{'\n'}
                      6. Вставьте полученную ссылку /exec выше.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
      </View>

      {isIdentityGateVisible && (
        <View style={styles.gateOverlay}>
          <IdentityGateForm
            initialProfile={myProfile}
            title={pendingAction === 'join' ? 'Как вас представить?' : 'Ваши данные для комнаты'}
            subtitle="Имя и телефон увидит вся комната. По номеру друзья переведут вам долг через СБП."
            submitLabel={
              pendingAction === 'join' ? 'Войти в комнату' : 'Создать комнату'
            }
            onCancel={handleIdentityCancel}
            onSave={handleIdentitySave}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  gateOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  tabContent: {
    paddingVertical: 4,
  },
  codeBanner: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  codeBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 6,
  },
  codeBannerText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  copyCodeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBannerHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  noCodeBox: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noCodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  noCodeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  joinHelpText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    gap: 8,
  },
  testResultText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  guideToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 16,
  },
  guideToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  guideContentBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  guideStepText: {
    fontSize: 12,
    lineHeight: 20,
  },
});
