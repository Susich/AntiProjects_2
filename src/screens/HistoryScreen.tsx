import React, { useState } from 'react';
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
import { ParticipantProfile, PartyEvent } from '../types';
import { formatPhone, formatRubles, getInitials } from '../utils/currency';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { ProfileModal } from '../components/profile/ProfileModal';

type HistorySubTab = 'parties' | 'friends';

interface HistoryScreenProps {
  onNavigateToParty: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onNavigateToParty }) => {
  const { theme } = useTheme();
  const history = usePartyStore((s) => s.history);
  const loadPartyFromHistory = usePartyStore((s) => s.loadPartyFromHistory);
  const deleteHistoryParty = usePartyStore((s) => s.deleteHistoryParty);

  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const addProfile = usePartyStore((s) => s.addProfile);
  const deleteProfile = usePartyStore((s) => s.deleteProfile);

  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<HistorySubTab>('parties');
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const handleLoadParty = (party: PartyEvent) => {
    Alert.alert(
      'Загрузить тусовку?',
      `Открыть «${party.title}» в активном чеке? Текущий несохранённый счёт будет заменён.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Загрузить',
          onPress: () => {
            loadPartyFromHistory(party.id);
            showToast(`Тусовка «${party.title}» загружена в редактор!`);
            onNavigateToParty();
          },
        },
      ]
    );
  };

  const handleDeleteParty = (party: PartyEvent) => {
    Alert.alert(
      'Удалить из архива?',
      `Вы действительно хотите удалить запись «${party.title}»?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            deleteHistoryParty(party.id);
            showToast('Запись удалена из архива', { type: 'info' });
          },
        },
      ]
    );
  };

  const handleSaveProfile = (data: Omit<ParticipantProfile, 'id'>) => {
    addProfile(data);
    setIsAddingProfile(false);
    showToast(`${data.name} сохранён в базу!`);
  };

  const calculatePartyTotal = (party: PartyEvent): number => {
    return (party.expenses || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
  };

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.colors.background }]}>
      {/* Sub Tabs Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          onPress={() => setActiveTab('parties')}
          style={[
            styles.switchBtn,
            {
              backgroundColor: activeTab === 'parties' ? theme.colors.primary : theme.colors.surface,
              borderColor: activeTab === 'parties' ? theme.colors.primary : theme.colors.surfaceBorder,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="archive-outline"
            size={16}
            color={activeTab === 'parties' ? theme.colors.textInverse : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.switchText,
              { color: activeTab === 'parties' ? theme.colors.textInverse : theme.colors.textMuted },
            ]}
          >
            Архив вечеринок ({history.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('friends')}
          style={[
            styles.switchBtn,
            {
              backgroundColor: activeTab === 'friends' ? theme.colors.primary : theme.colors.surface,
              borderColor: activeTab === 'friends' ? theme.colors.primary : theme.colors.surfaceBorder,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'friends' ? theme.colors.textInverse : theme.colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.switchText,
              { color: activeTab === 'friends' ? theme.colors.textInverse : theme.colors.textMuted },
            ]}
          >
            База участников ({savedProfiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'parties' ? (
          /* Parties Archive Tab */
          history.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="time-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
                Архив пуст
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Здесь сохраняются ваши прошлые тусовки, чтобы в любой момент можно было вспомнить расчёт и оплаты
              </Text>
            </View>
          ) : (
            <View style={styles.partiesList}>
              {history.map((party) => {
                const total = calculatePartyTotal(party);
                const dateStr = new Date(party.date).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });

                return (
                  <View
                    key={party.id}
                    style={[
                      styles.partyCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <View style={styles.partyCardHeader}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.partyCardTitle, { color: theme.colors.textPrimary }]}>
                          {party.title}
                        </Text>
                        <Text style={[styles.partyCardDate, { color: theme.colors.textMuted }]}>
                          {dateStr}
                        </Text>
                      </View>
                      <Text style={[styles.partyCardAmount, { color: theme.colors.primary }]}>
                        {formatRubles(total)}
                      </Text>
                    </View>

                    <View style={styles.partyStatsRow}>
                      <View
                        style={[
                          styles.partyStatPill,
                          {
                            backgroundColor: theme.colors.surfaceElevated,
                            borderColor: theme.colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Ionicons
                          name="people-outline"
                          size={13}
                          color={theme.colors.neonCyan}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.partyStatText, { color: theme.colors.textSecondary }]}>
                          {party.participants.length} чел.
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.partyStatPill,
                          {
                            backgroundColor: theme.colors.surfaceElevated,
                            borderColor: theme.colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Ionicons
                          name="receipt-outline"
                          size={13}
                          color={theme.colors.neonEmerald}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.partyStatText, { color: theme.colors.textSecondary }]}>
                          {party.expenses.length} счетов
                        </Text>
                      </View>
                    </View>

                    <View style={styles.partyCardActions}>
                      <Button
                        title="Загрузить в чек"
                        variant="secondary"
                        size="sm"
                        icon="refresh-outline"
                        onPress={() => handleLoadParty(party)}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <Button
                        title="Удалить"
                        variant="ghost"
                        size="sm"
                        icon="trash-outline"
                        onPress={() => handleDeleteParty(party)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* Friends Directory Tab */
          <View style={styles.friendsSection}>
            <Button
              title="Добавить в базу друзей"
              variant="primary"
              size="md"
              icon="person-add"
              onPress={() => setIsAddingProfile(true)}
              style={{ marginBottom: 16 }}
            />

            <View style={styles.friendsList}>
              {savedProfiles.map((profile) => {
                const phone = profile.paymentInfo.phone
                  ? formatPhone(profile.paymentInfo.phone)
                  : 'Номер для СБП не указан';

                return (
                  <View
                    key={profile.id}
                    style={[
                      styles.friendCard,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.surfaceBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.friendAvatar,
                        { backgroundColor: profile.avatarColor || theme.colors.primary },
                      ]}
                    >
                      <Text style={[styles.friendAvatarText, { color: theme.colors.textInverse }]}>
                        {getInitials(profile.name)}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.friendName, { color: theme.colors.textPrimary }]}>
                        {profile.name}
                      </Text>
                      <Text style={[styles.friendPhone, { color: theme.colors.textMuted }]}>
                        {phone}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.friendBankBadge,
                        {
                          borderColor: `${theme.colors.info}55`,
                          backgroundColor: `${theme.colors.info}18`,
                        },
                      ]}
                    >
                      <Text style={[styles.friendBankText, { color: theme.colors.info }]}>
                        СБП
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Удалить?', `Удалить ${profile.name}?`, [
                          { text: 'Отмена', style: 'cancel' },
                          {
                            text: 'Удалить',
                            style: 'destructive',
                            onPress: () => deleteProfile(profile.id),
                          },
                        ]);
                      }}
                      style={styles.deleteFriendBtn}
                    >
                      <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Profile Modal */}
      <ProfileModal
        visible={isAddingProfile}
        onClose={() => setIsAddingProfile(false)}
        onSave={handleSaveProfile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  partiesList: {
    gap: 12,
  },
  partyCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  partyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  partyCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  partyCardDate: {
    fontSize: 12,
    marginTop: 2,
  },
  partyCardAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  partyStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  partyStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  partyStatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  partyCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsSection: {
    paddingTop: 4,
  },
  friendsList: {
    gap: 8,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  friendAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
  },
  friendPhone: {
    fontSize: 12,
    marginTop: 1,
  },
  friendBankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  friendBankText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deleteFriendBtn: {
    padding: 6,
  },
});
