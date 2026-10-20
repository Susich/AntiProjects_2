import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../../store/usePartyStore';
import { useTheme } from '../../context/ThemeContext';
import { ParticipantProfile } from '../../types';
import { cleanPhone, formatPhone, getInitials } from '../../utils/currency';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { SavedFriendsModal } from './SavedFriendsModal';
import { ProfileModal } from '../profile/ProfileModal';
import { IdentityGateModal } from '../profile/IdentityGateModal';
import { useToast } from '../common/Toast';

export const ParticipantChips: React.FC = () => {
  const { theme } = useTheme();
  const currentParty = usePartyStore((s) => s.currentParty);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const myProfileId = usePartyStore((s) => s.myProfileId);
  const addProfile = usePartyStore((s) => s.addProfile);
  const updateProfile = usePartyStore((s) => s.updateProfile);
  const setMyProfile = usePartyStore((s) => s.setMyProfile);
  const addParticipantToParty = usePartyStore((s) => s.addParticipantToParty);
  const removeParticipantFromParty = usePartyStore((s) => s.removeParticipantFromParty);
  const { showToast } = useToast();

  const [newName, setNewName] = useState('');
  const [isFriendsModalVisible, setIsFriendsModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isSelfGateVisible, setIsSelfGateVisible] = useState(false);
  const [profileInitialName, setProfileInitialName] = useState('');
  const [editingProfile, setEditingProfile] = useState<ParticipantProfile | null>(null);
  const [addAfterEdit, setAddAfterEdit] = useState(false);

  // Resolve profile objects for current party
  const partyProfiles = currentParty.participants
    .map((id) => savedProfiles.find((p) => p.id === id))
    .filter(Boolean) as ParticipantProfile[];

  const myProfile = savedProfiles.find((p) => p.id === myProfileId) || null;
  const isMeInParty = Boolean(
    myProfile && (currentParty.participants || []).includes(myProfile.id)
  );
  const myProfileIsComplete = Boolean(
    myProfile?.name.trim() && cleanPhone(myProfile?.paymentInfo?.phone).length >= 10
  );
  const showSelfCard = !myProfile || !isMeInParty || !myProfileIsComplete;

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Check if a saved profile already exists with this name
    const existing = savedProfiles.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      if (currentParty.participants.includes(existing.id)) {
        showToast('Участник уже добавлен в текущий сбор', { type: 'warning' });
        return;
      }
      // Old profiles may have been created with a name only. Ask for the SBP
      // phone before letting them into the room.
      if (cleanPhone(existing.paymentInfo.phone).length < 10) {
        setEditingProfile(existing);
        setAddAfterEdit(true);
        showToast('Добавьте номер телефона для СБП', { type: 'info' });
        return;
      }
      addParticipantToParty(existing.id);
      setNewName('');
      showToast(`${existing.name} добавлен в сбор!`);
      return;
    }

    // New members always fill name + phone + optional SBP link, never just a name.
    setProfileInitialName(trimmed);
    setIsProfileModalVisible(true);
  };

  const handleSaveNewProfile = (data: Omit<ParticipantProfile, 'id'>) => {
    const created = addProfile(data);
    addParticipantToParty(created.id);
    setNewName('');
    setProfileInitialName('');
    setIsProfileModalVisible(false);
    showToast(`${created.name} добавлен в сбор!`);
  };

  const handleSaveSelf = (data: Omit<ParticipantProfile, 'id'>) => {
    let selfId = myProfile?.id;
    if (selfId) {
      updateProfile(selfId, data);
    } else {
      const created = addProfile(data);
      selfId = created.id;
      setMyProfile(created.id);
    }

    addParticipantToParty(selfId);
    setIsSelfGateVisible(false);
    showToast('Ваши данные сохранены — вы в сборе!', { type: 'success' });
  };

  const handleRemove = (profile: ParticipantProfile) => {
    const hasExpenses = currentParty.expenses.some(
      (exp) =>
        exp.paidById === profile.id ||
        exp.splitBetween.some((s) => s.userId === profile.id)
    );

    if (hasExpenses) {
      Alert.alert(
        'Убрать участника?',
        `«${profile.name}» участвует в чеках или оплачивал их. При удалении расходы будут пересчитаны между оставшимися.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Убрать',
            style: 'destructive',
            onPress: () => {
              removeParticipantFromParty(profile.id);
              showToast(`${profile.name} убран из сбора`, { type: 'info' });
            },
          },
        ]
      );
    } else {
      removeParticipantFromParty(profile.id);
      showToast(`${profile.name} убран`, { type: 'info' });
    }
  };

  const handleSaveProfile = (data: Omit<ParticipantProfile, 'id'>) => {
    if (editingProfile) {
      updateProfile(editingProfile.id, data);
      if (addAfterEdit) {
        addParticipantToParty(editingProfile.id);
        setNewName('');
        showToast(`${data.name} добавлен в сбор!`, { type: 'success' });
      } else {
        showToast(`Реквизиты «${data.name}» обновлены!`, { type: 'success' });
      }
      setAddAfterEdit(false);
      setEditingProfile(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* The current device user needs a complete SBP profile to participate. */}
      {showSelfCard && (
        <TouchableOpacity
          style={[
            styles.selfCard,
            {
              backgroundColor: `${theme.colors.primary}10`,
              borderColor: `${theme.colors.primary}55`,
            },
          ]}
          onPress={() => setIsSelfGateVisible(true)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.selfIconCircle,
              { backgroundColor: `${theme.colors.primary}20` },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.selfTitle, { color: theme.colors.textPrimary }]}>
              {!myProfile
                ? 'Сначала добавьте себя'
                : !myProfileIsComplete
                  ? 'Заполните телефон для СБП'
                  : 'Добавьте себя в сбор'}
            </Text>
            <Text style={[styles.selfSubtitle, { color: theme.colors.textSecondary }]}>
              {myProfileIsComplete
                ? 'Ваш профиль готов, но вас нет в текущем сборе'
                : 'Имя и телефон для СБП — без них друзья не смогут перевести вам долг'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.titleRow}>
        <View style={styles.titleWithBadge}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Участники тусовки
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
              {partyProfiles.length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsFriendsModalVisible(true)}
          style={[
            styles.pickSavedBtn,
            {
              backgroundColor: `${theme.colors.neonCyan}15`,
              borderColor: `${theme.colors.neonCyan}40`,
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people"
            size={14}
            color={theme.colors.neonCyan}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.pickSavedText, { color: theme.colors.neonCyan }]}>
            База профилей
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input + Fast Add row */}
      <View style={styles.inputRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input
            value={newName}
            onChangeText={setNewName}
            placeholder="Имя друга (например, Влад)..."
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            leftIcon="person-outline"
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <Button
          title="Добавить"
          variant="primary"
          size="md"
          icon="add"
          onPress={handleAdd}
          disabled={!newName.trim()}
        />
      </View>

      {/* Participant chips list */}
      {partyProfiles.length === 0 ? (
        <View
          style={[
            styles.emptyContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
            },
          ]}
        >
          <Ionicons name="beer-outline" size={26} color={theme.colors.textMuted} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            Добавьте себя и друзей, чтобы разделить счёт
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {partyProfiles.map((p) => {
            const isMe = p.id === myProfileId;
            const phone = p.paymentInfo.phone
              ? formatPhone(p.paymentInfo.phone)
              : 'СБП не указан';
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: isMe
                      ? theme.colors.primary
                      : theme.colors.surfaceBorder,
                  },
                ]}
                onPress={() => setEditingProfile(p)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: p.avatarColor || theme.colors.primary },
                  ]}
                >
                  <Text style={[styles.avatarInitials, { color: theme.colors.textInverse }]}>
                    {getInitials(p.name)}
                  </Text>
                </View>
                <View style={styles.chipTextContainer}>
                  <Text
                    style={[styles.chipName, { color: theme.colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {isMe ? `${p.name} · вы` : p.name}
                  </Text>
                  <Text
                    style={[
                      styles.chipPhone,
                      {
                        color: p.paymentInfo.phone
                          ? theme.colors.textMuted
                          : theme.colors.warning,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {phone}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRemove(p);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.chipRemove}
                >
                  <Ionicons name="close" size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Saved Friends / Profiles Modal */}
      <SavedFriendsModal
        visible={isFriendsModalVisible}
        onClose={() => setIsFriendsModalVisible(false)}
        onSelectFriend={(friend) => {
          addParticipantToParty(friend.id);
        }}
        alreadyInPartyIds={currentParty.participants}
      />

      {/* New friend profile: name + phone + optional SBP link */}
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => {
          setIsProfileModalVisible(false);
          setProfileInitialName('');
        }}
        onSave={handleSaveNewProfile}
        initialName={profileInitialName}
      />

      {/* The current user's own profile */}
      <IdentityGateModal
        visible={isSelfGateVisible}
        initialProfile={myProfile}
        title={myProfile ? 'Ваши данные' : 'Добавьте себя'}
        subtitle="Имя и телефон увидят участники сбора. По номеру они переведут вам долг через СБП."
        submitLabel={myProfile ? 'Сохранить и добавить' : 'Добавить в сбор'}
        onCancel={() => setIsSelfGateVisible(false)}
        onSave={handleSaveSelf}
      />

      {/* Profile Edit Modal from Group View */}
      {editingProfile && (
        <ProfileModal
          visible={Boolean(editingProfile)}
          onClose={() => {
            setEditingProfile(null);
            setAddAfterEdit(false);
          }}
          onSave={handleSaveProfile}
          editProfile={editingProfile}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  selfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  selfIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  selfSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  pickSavedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pickSavedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chipsScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 10,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  avatarInitials: {
    fontWeight: '800',
    fontSize: 10,
  },
  chipTextContainer: {
    marginRight: 6,
  },
  chipName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 110,
  },
  chipPhone: {
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 110,
  },
  chipRemove: {
    padding: 2,
    marginLeft: 2,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 13,
    marginLeft: 8,
  },
});
