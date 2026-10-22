import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../../store/usePartyStore';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import {
  createPartyInCloud,
  DEFAULT_GOOGLE_SCRIPT_URL,
  getGoogleScriptUrl,
  joinPartyInCloud,
  PartyApiResponse,
  setGoogleScriptUrl,
  testGoogleScriptConnection,
} from '../../api/googleSheets';
import { mapCloudExpenses, mapCloudParticipants, mapCloudShoppingList } from '../../utils/cloudSync';
import { copyToClipboard } from '../../utils/clipboard';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { BankPicker } from '../common/BankPicker';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { useToast } from '../common/Toast';
import { isNetworkOnline } from '../../services/networkService';
import { RoomQrModal } from './RoomQrModal';
import { QrScannerModal } from './QrScannerModal';

type CloudTab = 'room' | 'create' | 'join' | 'settings';
type BankAction = 'create' | 'join';

interface CloudSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

const TABS: { id: CloudTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'room', label: 'Комната', icon: 'people-outline' },
  { id: 'create', label: 'Создать', icon: 'add-circle-outline' },
  { id: 'join', label: 'Войти', icon: 'enter-outline' },
  { id: 'settings', label: 'Настройки', icon: 'settings-outline' },
];

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ visible, onClose }) => (
  <BottomSheetModal
    visible={visible}
    onClose={onClose}
    height="88%"
    maxHeight="92%"
  >
    {({ onScroll }) => <CloudSyncContent onClose={onClose} onScroll={onScroll} />}
  </BottomSheetModal>
);

const CloudSyncContent: React.FC<{
  onClose: () => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}> = ({ onClose, onScroll }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showToast } = useToast();

  const session = usePartyStore((s) => s.session);
  const currentParty = usePartyStore((s) => s.currentParty);
  const lastCloudSyncAt = usePartyStore((s) => s.lastCloudSyncAt);
  const syncPartyFromCloud = usePartyStore((s) => s.syncPartyFromCloud);
  const syncWithCloud = usePartyStore((s) => s.syncWithCloud);
  const saveCurrentPartyToHistory = usePartyStore((s) => s.saveCurrentPartyToHistory);
  const leaveParty = usePartyStore((s) => s.leaveParty);

  const [activeTab, setActiveTab] = useState<CloudTab>(
    currentParty.code ? 'room' : 'create'
  );
  const [createTitle, setCreateTitle] = useState(
    currentParty.code || currentParty.title === 'Тусовка'
      ? 'Новая тусовка'
      : currentParty.title
  );
  const [joinCode, setJoinCode] = useState('');
  const [scriptUrl, setScriptUrl] = useState(DEFAULT_GOOGLE_SCRIPT_URL);
  const [bankStep, setBankStep] = useState<BankAction | null>(null);
  const [selectedBank, setSelectedBank] = useState(session?.user.bank || 'Сбербанк');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void getGoogleScriptUrl().then((url) => {
      if (active) setScriptUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  const auth = session
    ? { userId: session.user.id, token: session.token }
    : null;

  const archiveCurrentRoom = () => {
    if ((currentParty.expenses || []).length > 0) {
      saveCurrentPartyToHistory();
    }
  };

  const applyCloudParty = (res: PartyApiResponse) => {
    if (!res.party) return;
    const participants = mapCloudParticipants(res);
    const expenses = mapCloudExpenses(res.expenses);
    const shoppingList = res.shoppingList ? mapCloudShoppingList(res.shoppingList) : [];
    const settledTransferIds = (res.paymentStatuses || [])
      .filter((status) => status.isPaid)
      .map((status) => status.transferId);

    syncPartyFromCloud({
      id: res.party.id,
      code: res.party.code,
      title: res.party.title,
      createdBy: res.party.createdBy || session?.user.id,
      date: res.party.createdAt || new Date().toISOString(),
      participants,
      expenses,
      shoppingList,
      settledTransferIds,
      deletedExpenseIds: [],
      pendingExpenseIds: [],
    });
  };

  const handleQrScanned = (scannedCode: string) => {
    const clean = scannedCode.trim().toUpperCase();
    setJoinCode(clean);
    showToast(`Код #${clean} распознан! ✨`, { type: 'success' });
    startBankStep('join', clean);
  };

  const startBankStep = (action: BankAction, overrideCode?: string) => {
    setError('');
    if (!auth) {
      setError('Требуется авторизация');
      return;
    }

    if (!isNetworkOnline()) {
      setError(
        action === 'create'
          ? 'Для создания новой общей комнаты требуется подключение к интернету.'
          : 'Для подключения к новой комнате требуется подключение к интернету.'
      );
      return;
    }

    const codeToJoin = overrideCode || joinCode;
    if (action === 'create' && createTitle.trim().length < 2) {
      setError('Введите название комнаты');
      return;
    }
    if (action === 'join' && codeToJoin.replace(/\s/g, '').length < 3) {
      setError('Введите код комнаты');
      return;
    }

    setSelectedBank(session?.user.bank || 'Сбербанк');
    setBankStep(action);
  };

  const handleConfirmBank = async () => {
    if (!auth || !bankStep || busy) return;

    if (!isNetworkOnline()) {
      setError('Отсутствует подключение к интернету. Проверьте сеть и повторите попытку.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (bankStep === 'create') {
        const res = await createPartyInCloud(
          createTitle.trim() || 'Новая тусовка',
          auth,
          selectedBank
        );
        if (!res.success || !res.party) {
          setError(res.error || 'Не удалось создать комнату');
          return;
        }

        archiveCurrentRoom();
        applyCloudParty(res);
        setBankStep(null);
        setActiveTab('room');
        showToast(`Комната #${res.party.code} создана`, { type: 'success' });
      } else {
        const code = joinCode.trim().toUpperCase();
        const res = await joinPartyInCloud(code, auth, selectedBank);
        if (!res.success || !res.party) {
          setError(res.error || 'Не удалось войти в комнату');
          return;
        }

        archiveCurrentRoom();
        applyCloudParty(res);
        setBankStep(null);
        setActiveTab('room');
        showToast(`Вы вошли в комнату #${res.party.code}`, { type: 'success' });
      }
    } catch (err: any) {
      setError(
        !isNetworkOnline()
          ? 'Отсутствует подключение к интернету. Проверьте соединение и повторите попытку.'
          : (err?.message || 'Ошибка сети')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async () => {
    if (!currentParty.code) return;
    const ok = await copyToClipboard(currentParty.code);
    if (!ok) {
      showToast('Не удалось скопировать код', { type: 'error' });
      return;
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSync = async () => {
    if (busy) return;
    if (!isNetworkOnline()) {
      showToast('Оффлайн-режим: синхронизация выполнится автоматически при появлении сети', {
        type: 'info',
      });
      return;
    }
    setBusy(true);
    const res = await syncWithCloud();
    setBusy(false);
    showToast(
      res.success ? 'Данные комнаты обновлены' : res.error || 'Ошибка синхронизации',
      { type: res.success ? 'success' : 'error' }
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Покинуть комнату?',
      'Вы перестанете получать обновления этого сбора. Локальный чек будет очищен.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Покинуть',
          style: 'destructive',
          onPress: () => {
            archiveCurrentRoom();
            // Optimistic leave: close modal instantly and return to main screen with zero lag
            onClose();
            void leaveParty();
            showToast('Вы вышли из комнаты', { type: 'info' });
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    setTesting(true);
    const result = await testGoogleScriptConnection(scriptUrl);
    setTesting(false);
    showToast(result.message, { type: result.success ? 'success' : 'error', duration: 5000 });
  };

  const handleSaveUrl = async () => {
    await setGoogleScriptUrl(scriptUrl.trim());
    const resolved = await getGoogleScriptUrl();
    setScriptUrl(resolved);
    showToast('URL Google Apps Script сохранён', { type: 'success' });
  };

  const handleResetUrl = async () => {
    await setGoogleScriptUrl('');
    setScriptUrl(DEFAULT_GOOGLE_SCRIPT_URL);
    showToast('Восстановлен стандартный URL', { type: 'info' });
  };

  const renderErrorBox = (retryFn?: () => void) => {
    if (!error) return null;
    return (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle" size={17} color={theme.colors.danger} />
        <View style={styles.errorContentBlock}>
          <Text style={styles.errorText}>{error}</Text>
          {retryFn && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError('');
                retryFn();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.retryButtonText}>Повторить попытку</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderBankStep = () => (
    <View style={styles.bankStep}>
      <View style={styles.bankStepHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setBankStep(null)}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.bankStepTitleBlock}>
          <Text style={styles.title}>Подтвердите банк</Text>
          <Text style={styles.subtitle}>
            Банк для этого сбора. По умолчанию — из личного профиля.
          </Text>
        </View>
      </View>

      <View style={styles.profileHint}>
        <Ionicons name="person-circle-outline" size={18} color={theme.colors.info} />
        <Text style={styles.profileHintText}>
          {session?.user.name}: {session?.user.bank}
        </Text>
      </View>

      <BankPicker
        label="Банк для этого сбора"
        value={selectedBank}
        onChange={setSelectedBank}
        helperText="Получатель увидит этот банк и номер телефона в итогах. Платёжные ссылки не создаются."
      />

      {!currentParty.code && (currentParty.expenses || []).length > 0 ? (
        <View style={styles.warningBox}>
          <Ionicons name="archive-outline" size={17} color={theme.colors.warning} />
          <Text style={styles.warningText}>
            Текущий локальный чек будет сохранён в архив, а облачная комната начнётся с
            чистого листа.
          </Text>
        </View>
      ) : null}

      {renderErrorBox(handleConfirmBank)}

      <View style={styles.bankActions}>
        <Button
          title="Отмена"
          variant="outline"
          onPress={() => setBankStep(null)}
          style={styles.bankActionButton}
          disabled={busy}
        />
        <Button
          title={bankStep === 'create' ? 'Создать комнату' : 'Войти в комнату'}
          icon={bankStep === 'create' ? 'add-circle-outline' : 'log-in-outline'}
          onPress={handleConfirmBank}
          loading={busy}
          disabled={busy}
          style={styles.bankActionButton}
        />
      </View>
    </View>
  );

  const renderRoom = () => {
    if (!currentParty.code) {
      return (
        <View style={styles.emptyRoom}>
          <View style={styles.emptyRoomIcon}>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.emptyRoomTitle}>Комната не подключена</Text>
          <Text style={styles.emptyRoomText}>
            Создайте общую комнату или войдите по коду. Участники и статусы оплат будут
            синхронизироваться автоматически.
          </Text>
          <View style={styles.emptyRoomActions}>
            <Button
              title="Создать"
              icon="add-circle-outline"
              onPress={() => setActiveTab('create')}
              style={styles.emptyRoomButton}
            />
            <Button
              title="Войти по коду"
              variant="outline"
              icon="enter-outline"
              onPress={() => setActiveTab('join')}
              style={styles.emptyRoomButton}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.roomContent}>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>КОД КОМНАТЫ</Text>
          <Text style={styles.codeValue}>{currentParty.code}</Text>
          <View style={styles.codeButtonsRow}>
            <TouchableOpacity
              style={[styles.copyCodeButton, copiedCode && styles.copyCodeButtonDone]}
              onPress={handleCopyCode}
              accessibilityRole="button"
            >
              <Ionicons
                name={copiedCode ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copiedCode ? theme.colors.success : theme.colors.primary}
              />
              <Text
                style={[
                  styles.copyCodeText,
                  copiedCode && { color: theme.colors.success },
                ]}
              >
                {copiedCode ? 'Скопировано!' : 'Скопировать'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qrCodeButton}
              onPress={() => setIsQrModalOpen(true)}
              accessibilityRole="button"
            >
              <Ionicons name="qr-code-outline" size={16} color={theme.colors.neonCyan} />
              <Text style={styles.qrCodeButtonText}>QR-код</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roomInfoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Название</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {currentParty.title}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Участники</Text>
            <Text style={styles.infoValue}>
              {currentParty.participants.length} чел.
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Оплаты</Text>
            <Text style={[styles.infoValue, { color: theme.colors.success }]}>
              {(currentParty.settledTransferIds || []).length} закрыто
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Обновлено</Text>
            <Text style={styles.infoValue}>
              {lastCloudSyncAt
                ? new Date(lastCloudSyncAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.liveHint}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            Статусы оплат и состав комнаты обновляются автоматически у всех участников.
          </Text>
        </View>

        <View style={styles.roomActions}>
          <Button
            title="Синхронизировать"
            icon="refresh-outline"
            variant="secondary"
            onPress={handleSync}
            loading={busy}
            disabled={busy}
          />
          <Button
            title="Покинуть комнату"
            icon="exit-outline"
            variant="outline"
            onPress={handleLeave}
            disabled={busy}
          />
        </View>
      </View>
    );
  };

  const renderCreate = () => (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Новая общая комната</Text>
      <Text style={styles.formHint}>
        Организатор автоматически становится участником. Друзья подключатся по коду и
        увидят свои профили, без ручного добавления в базу.
      </Text>

      <Input
        label="Название тусовки"
        placeholder="Например: Пятница в баре"
        leftIcon="sparkles-outline"
        value={createTitle}
        onChangeText={setCreateTitle}
        maxLength={48}
      />

      {renderErrorBox(() => startBankStep('create'))}

      <Button
        title="Продолжить"
        icon="arrow-forward-outline"
        iconPosition="right"
        onPress={() => startBankStep('create')}
        size="lg"
      />
    </View>
  );

  const renderJoin = () => (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Войти по коду</Text>
      <Text style={styles.formHint}>
        Попросите организатора прислать код комнаты или отсканируйте его QR-код камерой.
      </Text>

      <View style={styles.joinCodeRow}>
        <View style={styles.joinInputFlex}>
          <Input
            label="Код комнаты"
            placeholder="Например: PUB777"
            leftIcon="key-outline"
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={36}
          />
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setIsScannerOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Сканировать QR-код"
        >
          <Ionicons name="camera-outline" size={20} color={theme.colors.neonCyan} />
          <Text style={styles.scanButtonText}>Сканер QR</Text>
        </TouchableOpacity>
      </View>

      {renderErrorBox(() => startBankStep('join'))}

      <Button
        title="Войти в комнату"
        icon="arrow-forward-outline"
        iconPosition="right"
        onPress={() => startBankStep('join')}
        size="lg"
      />
    </View>
  );

  const renderSettings = () => (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Google Sheets / Apps Script</Text>
      <Text style={styles.formHint}>
        Приложение работает с вашей таблицей через Apps Script Web App. После обновления
        backend/Code.gs обязательно создайте новую версию развёртывания — URL при этом не
        меняется.
      </Text>

      <Input
        label="URL веб-приложения"
        placeholder="https://script.google.com/macros/s/.../exec"
        leftIcon="link-outline"
        value={scriptUrl}
        onChangeText={setScriptUrl}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        inputStyle={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      <View style={styles.settingsActions}>
        <Button
          title="Проверить"
          icon="pulse-outline"
          variant="outline"
          onPress={handleTestConnection}
          loading={testing}
          disabled={testing}
          style={styles.settingsButton}
        />
        <Button
          title="Сохранить URL"
          icon="save-outline"
          onPress={handleSaveUrl}
          style={styles.settingsButton}
        />
      </View>
      <TouchableOpacity onPress={handleResetUrl} style={styles.resetUrlLink}>
        <Text style={styles.resetUrlText}>Восстановить стандартный URL</Text>
      </TouchableOpacity>

      <View style={styles.versionHint}>
        <Ionicons name="information-circle-outline" size={17} color={theme.colors.info} />
        <Text style={styles.versionHintText}>
          Проверка подключения требует API версии 2: авторизация, статусы оплат и состав
          комнаты.
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {bankStep ? (
        <>
          <TouchableOpacity
            style={styles.closeButtonAbsolute}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {renderBankStep()}
          </ScrollView>
        </>
      ) : (
        <>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Общая комната</Text>
                  <Text style={styles.subtitle}>
                    Авторизованные участники и оплаты в одном месте
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                >
                  <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabs}>
                {TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setActiveTab(tab.id);
                      setError('');
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={tab.icon}
                      size={15}
                      color={
                        activeTab === tab.id
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === tab.id && styles.tabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {activeTab === 'room' && renderRoom()}
            {activeTab === 'create' && renderCreate()}
            {activeTab === 'join' && renderJoin()}
            {activeTab === 'settings' && renderSettings()}
          </ScrollView>
        </>
      )}

      {busy && bankStep ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.busyText}>Связываемся с Google Sheets...</Text>
        </View>
      ) : null}

      <QrScannerModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQrScanned}
      />
      <RoomQrModal
        visible={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        partyCode={currentParty.code || ''}
        partyTitle={currentParty.title}
        partyId={currentParty.id}
      />
    </KeyboardAvoidingView>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlay,
    },
    keyboard: {
      flex: 1,
      width: '100%',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 4,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      maxHeight: '100%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceBorder,
      marginBottom: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    headerText: {
      flex: 1,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    closeButtonAbsolute: {
      position: 'absolute',
      right: theme.spacing.lg,
      top: theme.spacing.md,
      zIndex: 2,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      padding: 4,
      marginBottom: theme.spacing.lg,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
    },
    tabActive: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    tabText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    tabTextActive: {
      color: theme.colors.primary,
    },
    scrollContent: {
      paddingBottom: theme.spacing.lg,
    },
    form: {
      gap: theme.spacing.md,
    },
    formTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    formHint: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: theme.spacing.xs,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: `${theme.colors.danger}14`,
      borderColor: `${theme.colors.danger}55`,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
    },
    errorContentBlock: {
      flex: 1,
      gap: 6,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 12,
      lineHeight: 17,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: `${theme.colors.primary}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}40`,
      marginTop: 2,
    },
    retryButtonText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: `${theme.colors.warning}12`,
      borderColor: `${theme.colors.warning}44`,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
    },
    warningText: {
      flex: 1,
      color: theme.colors.warning,
      fontSize: 11,
      lineHeight: 16,
    },
    bankStep: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    bankStepHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingRight: 34,
    },
    bankStepTitleBlock: {
      flex: 1,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    profileHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: `${theme.colors.info}10`,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
    },
    profileHintText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    bankActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    bankActionButton: {
      flex: 1,
    },
    emptyRoom: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyRoomIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
    },
    emptyRoomTitle: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      marginTop: theme.spacing.sm,
    },
    emptyRoomText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      maxWidth: 300,
    },
    emptyRoomActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
      width: '100%',
    },
    emptyRoomButton: {
      flex: 1,
    },
    roomContent: {
      gap: theme.spacing.md,
    },
    codeCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorderActive,
      borderRadius: theme.borderRadius.xl,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
    },
    codeLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.3,
    },
    codeValue: {
      color: theme.colors.primary,
      fontSize: 38,
      fontWeight: '900',
      letterSpacing: 4,
      marginVertical: theme.spacing.sm,
    },
    codeButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    copyCodeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.primary}12`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}44`,
    },
    copyCodeButtonDone: {
      backgroundColor: `${theme.colors.success}12`,
      borderColor: `${theme.colors.success}44`,
    },
    copyCodeText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    qrCodeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.neonCyan}12`,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}44`,
    },
    qrCodeButtonText: {
      color: theme.colors.neonCyan,
      fontSize: 12,
      fontWeight: '700',
    },
    joinCodeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    joinInputFlex: {
      flex: 1,
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 50,
      paddingHorizontal: 14,
      backgroundColor: `${theme.colors.neonCyan}16`,
      borderWidth: 1,
      borderColor: `${theme.colors.neonCyan}45`,
      borderRadius: theme.borderRadius.md,
      marginBottom: 0,
    },
    scanButtonText: {
      color: theme.colors.neonCyan,
      fontSize: 13,
      fontWeight: '700',
    },
    roomInfoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      paddingHorizontal: theme.spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: 10,
    },
    infoLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    infoValue: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
    },
    infoDivider: {
      height: 1,
      backgroundColor: theme.colors.surfaceBorder,
    },
    liveHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 2,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
    },
    liveText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    roomActions: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    settingsActions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    settingsButton: {
      flex: 1,
    },
    resetUrlLink: {
      alignSelf: 'center',
      paddingVertical: 6,
    },
    resetUrlText: {
      color: theme.colors.info,
      fontSize: 12,
      fontWeight: '600',
    },
    versionHint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: `${theme.colors.info}0D`,
      borderRadius: theme.borderRadius.md,
    },
    versionHintText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    busyOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.xl,
      gap: theme.spacing.sm,
    },
    busyText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
