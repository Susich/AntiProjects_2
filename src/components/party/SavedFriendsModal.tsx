import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { ParticipantProfile } from '../../types';
import { usePartyStore } from '../../store/usePartyStore';
import { Button } from '../common/Button';
import { formatPhone, cleanPhone, getInitials } from '../../utils/currency';
import { useToast } from '../common/Toast';
import { ProfileModal } from '../profile/ProfileModal';

interface SavedFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectFriend: (profile: ParticipantProfile) => void;
  alreadyInPartyIds: string[];
}

export const SavedFriendsModal: React.FC<SavedFriendsModalProps> = ({
  visible,
  onClose,
  onSelectFriend,
  alreadyInPartyIds,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const savedProfiles = usePartyStore((s) => s.savedProfiles);
  const addProfile = usePartyStore((s) => s.addProfile);
  const updateProfile = usePartyStore((s) => s.updateProfile);
  const removeParticipantFromParty = usePartyStore((s) => s.removeParticipantFromParty);
  const { showToast } = useToast();

  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ParticipantProfile | null>(null);

  const handleSaveNewProfile = (data: Omit<ParticipantProfile, 'id'>) => {
    const created = addProfile(data);
    onSelectFriend(created);
    setIsCreatingProfile(false);
    showToast(`${created.name} создан и добавлен в тусовку!`);
  };

  // A legacy saved profile may still have no phone. Finish its requisites
  // before adding it to the room so nobody joins without SBP details.
  const handleSelectProfile = (profile: ParticipantProfile) => {
    if (cleanPhone(profile.paymentInfo.phone).length < 10) {
      setEditingProfile(profile);
      return;
    }
    onSelectFriend(profile);
    showToast(`${profile.name} добавлен на тусовку!`);
  };

  const handleUpdateAndSelect = (data: Omit<ParticipantProfile, 'id'>) => {
    if (!editingProfile) return;
    updateProfile(editingProfile.id, data);
    onSelectFriend({
      ...editingProfile,
      ...data,
      paymentInfo: { ...data.paymentInfo },
    });
    setEditingProfile(null);
    showToast(`${data.name} добавлен на тусовку!`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>База участников</Text>
              <Text style={styles.sheetSubtitle}>
                Быстрый выбор участников с готовыми реквизитами
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Create Button */}
          <TouchableOpacity
            style={styles.openNewFormBtn}
            onPress={() => setIsCreatingProfile(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.openNewFormText}>Создать нового участника с реквизитами</Text>
          </TouchableOpacity>

          {/* Profiles List */}
          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {savedProfiles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={38} color={theme.colors.textMuted} />
                <Text style={styles.emptyText}>База профилей пока пуста</Text>
              </View>
            ) : (
              savedProfiles.map((profile) => {
                const inParty = alreadyInPartyIds.includes(profile.id);

                return (
                  <View key={profile.id} style={styles.friendRow}>
                    <View style={styles.friendLeft}>
                      <View
                        style={[
                          styles.avatarPill,
                          { backgroundColor: profile.avatarColor || theme.colors.info },
                        ]}
                      >
                        <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{profile.name}</Text>
                        <Text
                          style={[
                            styles.friendPhone,
                            {
                              color: profile.paymentInfo.phone
                                ? theme.colors.textMuted
                                : theme.colors.warning,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {profile.paymentInfo.phone
                            ? formatPhone(profile.paymentInfo.phone)
                            : 'Телефон для СБП не указан'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.friendActions}>
                      {inParty ? (
                        <TouchableOpacity
                          onPress={() => {
                            removeParticipantFromParty(profile.id);
                            showToast(`${profile.name} убран из сбора`, { type: 'info' });
                          }}
                          style={styles.inPartyTag}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={theme.colors.success}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.inPartyText}>В сборе</Text>
                        </TouchableOpacity>
                      ) : (
                        <Button
                          title="+ Добавить"
                          size="sm"
                          variant="secondary"
                          icon="add"
                          onPress={() => handleSelectProfile(profile)}
                        />
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Done Button */}
          <Button
            title="Готово"
            variant="primary"
            size="md"
            onPress={onClose}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>

      {/* Modal for creating a new profile */}
      <ProfileModal
        visible={isCreatingProfile}
        onClose={() => setIsCreatingProfile(false)}
        onSave={handleSaveNewProfile}
      />

      {/* Completing a legacy profile that has no phone */}
      <ProfileModal
        visible={Boolean(editingProfile)}
        editProfile={editingProfile}
        onClose={() => setEditingProfile(null)}
        onSave={handleUpdateAndSelect}
      />
    </Modal>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      padding: 20,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorderActive,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
      gap: 10,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    openNewFormBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: theme.borderRadius.md,
      backgroundColor: `${theme.colors.primary}14`,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}4D`,
      marginBottom: 14,
      gap: 8,
    },
    openNewFormText: {
      color: theme.colors.primary,
      fontWeight: '600',
      fontSize: 14,
      flexShrink: 1,
    },
    scrollArea: {
      maxHeight: 300,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 30,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginTop: 8,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.surfaceBorder,
    },
    friendLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    avatarPill: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: theme.colors.textInverse,
      fontWeight: '800',
      fontSize: 13,
    },
    friendName: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
      fontSize: 15,
    },
    bankSmall: {
      fontSize: 11,
      fontWeight: '700',
    },
    friendPhone: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    friendActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    inPartyTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: `${theme.colors.success}26`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}4D`,
    },
    inPartyText: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: '600',
    },
  });
