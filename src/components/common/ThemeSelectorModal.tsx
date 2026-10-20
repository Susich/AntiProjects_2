import React from 'react';
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
import { useTheme, ThemeId } from '../../context/ThemeContext';
import { Button } from './Button';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, themeId, setThemeId, availableThemes } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSelect = (id: ThemeId) => {
    setThemeId(id);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: theme.colors.overlay,
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
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
                  { backgroundColor: `${theme.colors.primary}20` },
                ]}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.modalTitle, { color: theme.colors.textPrimary }]}
                >
                  Тема оформления
                </Text>
                <Text
                  style={[styles.modalSubtitle, { color: theme.colors.textMuted }]}
                >
                  Выберите визуальный стиль интерфейса
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

          {/* Themes List */}
          <ScrollView
            contentContainerStyle={styles.themesList}
            showsVerticalScrollIndicator={false}
          >
            {availableThemes.map((item) => {
              const isSelected = item.id === themeId;
              const accentColor = item.colors.primary;
              const bgPreview = item.colors.background;
              const surfacePreview = item.colors.surface;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: item.colors.surface,
                      borderColor: isSelected
                        ? accentColor
                        : item.colors.surfaceBorder,
                    },
                    isSelected && {
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.8}
                >
                  {/* Top Bar with Name & Radio */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text
                        style={[
                          styles.themeName,
                          { color: item.colors.textPrimary },
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.isDark ? (
                        <View
                          style={[
                            styles.modeBadge,
                            { backgroundColor: `${item.colors.textPrimary}14` },
                          ]}
                        >
                          <Ionicons name="moon" size={11} color={item.colors.neonCyan} />
                          <Text style={[styles.modeText, { color: item.colors.neonCyan }]}>
                            Dark
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.modeBadge,
                            { backgroundColor: `${item.colors.textPrimary}14` },
                          ]}
                        >
                          <Ionicons name="sunny" size={11} color={item.colors.neonAmber} />
                          <Text style={[styles.modeText, { color: item.colors.neonAmber }]}>
                            Light
                          </Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected
                            ? accentColor
                            : item.colors.textMuted,
                          backgroundColor: isSelected
                            ? accentColor
                            : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={item.colors.textInverse}
                        />
                      )}
                    </View>
                  </View>

                  {/* Tagline */}
                  <Text
                    style={[
                      styles.themeTagline,
                      { color: item.colors.textSecondary },
                    ]}
                  >
                    {item.tagline}
                  </Text>

                  {/* Palette Preview Swatches */}
                  <View style={styles.paletteRow}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: bgPreview, borderColor: item.colors.surfaceBorder },
                      ]}
                    />
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: surfacePreview, borderColor: item.colors.surfaceBorder },
                      ]}
                    />
                    <View
                      style={[styles.swatch, { backgroundColor: item.colors.primary }]}
                    />
                    <View
                      style={[styles.swatch, { backgroundColor: item.colors.secondary }]}
                    />
                    <View
                      style={[styles.swatch, { backgroundColor: item.colors.accent }]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Done Button */}
          <Button
            title="Готово"
            variant="primary"
            size="md"
            onPress={onClose}
            style={{ marginTop: 14 }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
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
  themesList: {
    gap: 12,
    paddingVertical: 4,
  },
  themeCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTagline: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
