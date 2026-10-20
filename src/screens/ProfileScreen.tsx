import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../store/usePartyStore';
import { useTheme } from '../context/ThemeContext';
import { ParticipantProfile } from '../types';
import { formatPhone, getInitials } from '../utils/currency';
import { getGoogleScriptUrl } from '../api/googleSheets';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { useToast } from '../components/common/Toast';
import { ProfileModal } from '../components/profile/ProfileModal';
import { ThemeSelectorModal } from '../components/common/ThemeSelectorModal';
import { CloudSyncModal } from '../components/party/CloudSyncModal';

export const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const myProfileId = usePartyStore((s) => s.myProfileId);
  const addProfile = usePartyStore((s) => s.addProfile);
  const updateProfile = usePartyStore((s) => s.updateProfile);
  const deleteProfile = usePartyStore((s) => s.deleteProfile);
  const setMyProfile = usePartyStore((s) => s.setMyProfile);
  const currentPartyParticipants = usePartyStore((s) => s.currentParty.participants);
  const addParticipantToParty = usePartyStore((s) => s.addParticipantToParty);
  const removeParticipantFromParty = usePartyStore((s) => s.removeParticipantFromParty);

  const { showToast } = useToast();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isThemeModalVisible, setIsThemeModalVisible] = useState(false);
  const [isCloudModalVisible, setIsCloudModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ParticipantProfile | null>(null);
  const [hasCloudUrl, setHasCloudUrl] = useState(false);

  useEffect(() => {
    getGoogleScriptUrl().then((url) => {
      setHasCloudUrl(Boolean(url && url.trim().length > 0));
    });
  }, [isCloudModalVisible]);

  const handleOpenAdd = () => {
    setEditingProfile(null);
    setIsModalVisible(true);
  };

  const handleOpenEdit = (profile: ParticipantProfile) => {
    setEditingProfile(profile);
    setIsModalVisible(true);
  };

  const handleSaveProfile = (data: Omit<ParticipantProfile, 'id'>) => {
    if (editingProfile) {
      updateProfile(editingProfile.id, data);
      showToast(`Профиль «${data.name}» обновлён!`, { type: 'success' });
    } else {
      const created = addProfile(data);
      // The first profile created from the settings screen is naturally the
      // device owner, so it becomes "me" without an extra step.
      if (!myProfileId && savedProfiles.length === 0) {
        setMyProfile(created.id);
      }
      addParticipantToParty(created.id);
      showToast(`Профиль «${created.name}» сохранён в базу и добавлен в сбор!`, {
        type: 'success',
      });
    }
  };

  const handleMakeMe = (profile: ParticipantProfile) => {
    setMyProfile(profile.id);
    showToast(`«${profile.name}» — теперь ваш профиль в комнатах`, {
      type: 'success',
    });
  };

  const handleDeleteProfile = (profile: ParticipantProfile) => {
    Alert.alert(
      'Удалить профиль?',
      `Удалить «${profile.name}» из базы профилей?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            deleteProfile(profile.id);
            showToast(`Профиль «${profile.name}» удалён`, { type: 'info' });
          },
        },
      ]
    );
  };

  const handleTogglePartyParticipation = (profileId: string, name: string) => {
    const inParty = currentPartyParticipants.includes(profileId);
    if (inParty) {
      removeParticipantFromParty(profileId);
      showToast(`«${name}» удалён из текущего сбора`, { type: 'info' });
    } else {
      addParticipantToParty(profileId);
      showToast(`«${name}» добавлен в текущий сбор!`, { type: 'success' });
    }
  };

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header */}
        <View style={styles.titleSection}>
          <Text style={[styles.screenHeading, { color: theme.colors.textPrimary }]}>
            Настройки и реквизиты
          </Text>
          <Text style={[styles.screenSubheading, { color: theme.colors.textSecondary }]}>
            Управление участниками, темами оформления и синхронизацией с Google Sheets
          </Text>
        </View>

        {/* 1. Theme Configuration Card */}
        <TouchableOpacity
          style={[
            styles.configCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
            },
          ]}
          onPress={() => setIsThemeModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.configCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={[
                  styles.configIconCircle,
                  { backgroundColor: `${theme.colors.accent}20` },
                ]}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.configCardTitle, { color: theme.colors.textPrimary }]}>
                  Тема: {theme.name}
                </Text>
                <Text style={[styles.configCardSub, { color: theme.colors.textMuted }]}>
                  {theme.tagline}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* 2. Google Sheets Cloud Backend Card */}
        <TouchableOpacity
          style={[
            styles.configCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: hasCloudUrl
                ? `${theme.colors.neonCyan}60`
                : theme.colors.surfaceBorder,
            },
          ]}
          onPress={() => setIsCloudModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.configCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={[
                  styles.configIconCircle,
                  { backgroundColor: `${theme.colors.neonCyan}20` },
                ]}
              >
                <Ionicons
                  name={hasCloudUrl ? 'cloud-done-outline' : 'cloud-offline-outline'}
                  size={20}
                  color={hasCloudUrl ? theme.colors.neonCyan : theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.configCardTitle, { color: theme.colors.textPrimary }]}>
                  Google Sheets Backend
                </Text>
                <Text style={[styles.configCardSub, { color: theme.colors.textMuted }]}>
                  {hasCloudUrl
                    ? 'Облако подключено • Нажмите для синхронизации'
                    : 'URL не настроен • Нажмите для подключения'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Action Button: Add New Profile */}
        <Button
          title="Добавить новый профиль"
          variant="primary"
          size="md"
          icon="person-add-outline"
          onPress={handleOpenAdd}
          style={styles.addProfileBtn}
        />

        {/* Profiles List Header */}
        <View style={styles.profilesHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Сохранённые профили
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.surfaceBorder,
              },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
              {savedProfiles.length}
            </Text>
          </View>
        </View>

        {savedProfiles.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
              },
            ]}
          >
            <Ionicons name="people-outline" size={42} color={theme.colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
              База профилей пуста
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Добавьте себя и друзей с номером телефона и СБП-ссылкой — приложение подставит реквизиты в долги автоматически
            </Text>
          </View>
        ) : (
          <View style={styles.profilesList}>
            {savedProfiles.map((profile) => {
              const inParty = currentPartyParticipants.includes(profile.id);
              const isMe = profile.id === myProfileId;
              const phoneFormatted = profile.paymentInfo.phone
                ? formatPhone(profile.paymentInfo.phone)
                : 'Номер не указан';

              return (
                <View
                  key={profile.id}
                  style={[
                    styles.profileCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: isMe
                        ? theme.colors.primary
                        : theme.colors.surfaceBorder,
                    },
                  ]}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.userInfoRow}>
                      <View
                        style={[
                          styles.avatarPill,
                          { backgroundColor: profile.avatarColor || theme.colors.primary },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: theme.colors.textInverse }]}>
                          {getInitials(profile.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
                          {profile.name}
                        </Text>
                        <Text style={[styles.profilePhone, { color: theme.colors.textMuted }]}>
                          {phoneFormatted}
                        </Text>
                      </View>
                    </View>

                    {/* "Me" badge, otherwise a neutral SBP badge */}
                    <View
                      style={[
                        styles.bankBadge,
                        isMe
                          ? {
                              borderColor: `${theme.colors.primary}66`,
                              backgroundColor: `${theme.colors.primary}18`,
                            }
                          : {
                              borderColor: `${theme.colors.info}55`,
                              backgroundColor: `${theme.colors.info}18`,
                            },
                      ]}
                    >
                      <Ionicons
                        name={isMe ? 'star' : 'flash-outline'}
                        size={13}
                        color={isMe ? theme.colors.primary : theme.colors.info}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.bankBadgeText,
                          { color: isMe ? theme.colors.primary : theme.colors.info },
                        ]}
                      >
                        {isMe ? 'Вы' : 'СБП'}
                      </Text>
                    </View>
                  </View>

                  {/* Collection URL Row if specified */}
                  {profile.paymentInfo.sbpQrOrUrl && (
                    <View
                      style={[
                        styles.collectionUrlRow,
                        { backgroundColor: `${theme.colors.neonCyan}12` },
                      ]}
                    >
                      <Ionicons name="link-outline" size={13} color={theme.colors.neonCyan} />
                      <Text
                        style={[styles.collectionUrlText, { color: theme.colors.neonCyan }]}
                        numberOfLines={1}
                      >
                        {profile.paymentInfo.sbpQrOrUrl}
                      </Text>
                    </View>
                  )}

                  {/* Actions Row */}
                  <View
                    style={[
                      styles.cardFooterRow,
                      { borderTopColor: theme.colors.surfaceBorder },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleTogglePartyParticipation(profile.id, profile.name)}
                      style={[
                        styles.partyToggleBtn,
                        {
                          backgroundColor: inParty
                            ? theme.colors.primary
                            : `${theme.colors.primary}18`,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={inParty ? 'checkmark-circle' : 'add-circle-outline'}
                        size={15}
                        color={inParty ? theme.colors.textInverse : theme.colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.partyToggleText,
                          {
                            color: inParty
                              ? theme.colors.textInverse
                              : theme.colors.primary,
                          },
                        ]}
                      >
                        {inParty ? 'В сборе' : '+ В сбор'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.cardActionsRight}>
                      {!isMe && (
                        <TouchableOpacity
                          onPress={() => handleMakeMe(profile)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[styles.iconBtn, { marginRight: 12 }]}
                        >
                          <Ionicons
                            name="star-outline"
                            size={17}
                            color={theme.colors.warning}
                          />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleOpenEdit(profile)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="create-outline" size={17} color={theme.colors.neonCyan} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteProfile(profile)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.iconBtn, { marginLeft: 12 }]}
                      >
                        <Ionicons name="trash-outline" size={17} color={theme.colors.neonPink} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Informative Hint Card */}
        <Card
          title="Как работают переводы по СБП?"
          subtitle="Мгновенный переход без комиссии между российскими банками"
          icon="shield-checkmark-outline"
          variant="accent"
          style={{ marginTop: 14 }}
        >
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            • Каждый участник указывает имя, телефон и по желанию СБП-ссылку — банк
            получателя указывать не нужно.{'\n'}
            • «Оплатить по СБП» сразу открывает СБП-ссылку получателя: банк
            плательщика выбирается автоматически.{'\n'}
            • Если ссылки нет, приложение копирует номер: откройте свой банк →
            «Перевод по СБП» и вставьте номер.{'\n'}
            • СБП работает между всеми банками, поэтому список банков в профилях
            больше не нужен.
          </Text>
        </Card>
      </ScrollView>

      {/* Profile Create / Edit Modal */}
      <ProfileModal
        visible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        editProfile={editingProfile}
      />

      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        visible={isThemeModalVisible}
        onClose={() => setIsThemeModalVisible(false)}
      />

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={isCloudModalVisible}
        onClose={() => setIsCloudModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 16,
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubheading: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  configCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  configCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  configCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  configCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  addProfileBtn: {
    marginTop: 6,
    marginBottom: 20,
  },
  profilesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profilesList: {
    gap: 10,
    marginBottom: 16,
  },
  profileCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profilePhone: {
    fontSize: 12,
    marginTop: 1,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  bankBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  collectionUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  collectionUrlText: {
    fontSize: 11,
    marginLeft: 6,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  partyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  partyToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 4,
  },
  emptyContainer: {
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
