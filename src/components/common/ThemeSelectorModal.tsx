import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeId, ThemeTokens } from '../../context/ThemeContext';
import { Button } from './Button';
import { BottomSheetModal } from './BottomSheetModal';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, themeId, setThemeId, availableThemes } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSelect = (id: ThemeId) => {
    setThemeId(id);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="92%"
      height="88%"
    >
      {({ onScroll }) => (
        <View style={styles.sheetContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.headerIconCircle}>
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  Тема оформления
                </Text>
                <Text style={styles.modalSubtitle}>
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
            style={styles.themesScrollView}
            contentContainerStyle={styles.themesList}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
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
          <View style={styles.doneContainer}>
            <Button
              title="Готово"
              variant="primary"
              size="md"
              onPress={onClose}
            />
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    sheetContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 4,
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
      backgroundColor: `${theme.colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      marginTop: 2,
      color: theme.colors.textMuted,
    },
    closeBtn: {
      padding: 4,
    },
    themesScrollView: {
      flex: 1,
    },
    themesList: {
      gap: 12,
      paddingTop: 4,
      paddingBottom: 28,
    },
    doneContainer: {
      paddingTop: 12,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
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
}
