import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePartyStore } from '../../store/usePartyStore';
import { useTheme } from '../../context/ThemeContext';
import { Input } from './Input';
import { Button } from './Button';
import { useToast } from './Toast';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { CloudSyncModal } from '../party/CloudSyncModal';

export const Header: React.FC = () => {
  const { theme } = useTheme();
  const currentParty = usePartyStore((s) => s.currentParty);
  const setPartyTitle = usePartyStore((s) => s.setPartyTitle);
  const resetParty = usePartyStore((s) => s.resetParty);
  const saveCurrentPartyToHistory = usePartyStore((s) => s.saveCurrentPartyToHistory);
  const { showToast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [tempTitle, setTempTitle] = useState(currentParty.title);

  const handleOpenEdit = () => {
    setTempTitle(currentParty.title);
    setIsEditModalOpen(true);
  };

  const handleSaveTitle = () => {
    const trimmed = tempTitle.trim();
    if (trimmed) {
      setPartyTitle(trimmed);
      showToast('Название сохранено');
    }
    setIsEditModalOpen(false);
  };

  const handlePromptReset = () => {
    Alert.alert(
      'Новая тусовка?',
      'Вы уверены, что хотите начать новый чек? Текущие позиции и участники будут сброшены (вы можете предварительно сохранить их в Историю).',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить и очистить',
          onPress: () => {
            saveCurrentPartyToHistory();
            resetParty();
            showToast('Чек сохранён в Историю и очищен');
          },
        },
        {
          text: 'Очистить без сохранения',
          style: 'destructive',
          onPress: () => {
            resetParty();
            showToast('Чек очищен', { type: 'info' });
          },
        },
      ]
    );
  };

  const handleQuickSave = () => {
    saveCurrentPartyToHistory();
    showToast('Тусовка сохранена в Историю!', { type: 'success' });
  };

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.surfaceBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoPill,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Ionicons name="wine-outline" size={17} color={theme.colors.textInverse} />
          </View>
          <View>
            <Text
              style={[styles.brandTitle, { color: theme.colors.textPrimary }]}
            >
              PartySplit
            </Text>
            <Text
              style={[styles.brandSubtitle, { color: theme.colors.primaryLight }]}
            >
              Делим счёт честно
            </Text>
          </View>
        </View>

        {/* Header Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Cloud Sync Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsCloudModalOpen(true)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: currentParty.code
                  ? theme.colors.neonCyan
                  : theme.colors.surfaceBorder,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={currentParty.code ? 'cloud-done-outline' : 'cloud-outline'}
              size={18}
              color={
                currentParty.code
                  ? theme.colors.neonCyan
                  : theme.colors.textSecondary
              }
            />
            {currentParty.code && (
              <View
                style={[
                  styles.activeCloudDot,
                  { backgroundColor: theme.colors.neonCyan },
                ]}
              />
            )}
          </TouchableOpacity>

          {/* Theme Switcher Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsThemeModalOpen(true)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                marginLeft: 7,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="color-palette-outline"
              size={18}
              color={theme.colors.accent}
            />
          </TouchableOpacity>

          {/* Save to History Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleQuickSave}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                marginLeft: 7,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="bookmark-outline"
              size={18}
              color={theme.colors.neonEmerald}
            />
          </TouchableOpacity>

          {/* Reset Party Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handlePromptReset}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.surfaceBorder,
                marginLeft: 7,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Party Name Banner & Cloud Room Badge */}
      <View style={styles.bannerRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenEdit}
          style={[
            styles.partyNameBanner,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.surfaceBorder,
              flex: 1,
            },
          ]}
        >
          <View style={styles.partyNameLeft}>
            <Ionicons
              name="sparkles"
              size={14}
              color={theme.colors.primary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.partyNameText, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {currentParty.title || 'Нажмите, чтобы задать название'}
            </Text>
          </View>
          <Ionicons
            name="pencil"
            size={13}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Room Code Badge (if connected to Google Sheets) */}
        {currentParty.code && (
          <TouchableOpacity
            onPress={() => setIsCloudModalOpen(true)}
            style={[
              styles.roomCodeBadge,
              {
                backgroundColor: `${theme.colors.neonCyan}18`,
                borderColor: theme.colors.neonCyan,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={13}
              color={theme.colors.neonCyan}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.roomCodeText, { color: theme.colors.neonCyan }]}
            >
              {currentParty.code}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit Party Title Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.surfaceBorderActive,
              },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: theme.colors.textPrimary }]}
            >
              Название события
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}
            >
              Это название будет отображаться в сообщениях должникам и в чеке
            </Text>

            <Input
              value={tempTitle}
              onChangeText={setTempTitle}
              placeholder="Например: Бар «Руки Вверх», ДР Сани..."
              autoFocus
              clearButton
            />

            <View style={styles.modalActions}>
              <Button
                title="Отмена"
                variant="secondary"
                size="md"
                onPress={() => setIsEditModalOpen(false)}
                style={{ flex: 1, marginRight: 10 }}
              />
              <Button
                title="Сохранить"
                variant="primary"
                size="md"
                onPress={handleSaveTitle}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        visible={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: Platform.OS === 'web' ? 16 : 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeCloudDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partyNameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  partyNameLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  partyNameText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  roomCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  roomCodeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
