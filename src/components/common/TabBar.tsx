import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export type TabId = 'party' | 'results' | 'profile' | 'history';

interface TabBarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  itemsBadgeCount?: number;
  participantsBadgeCount?: number;
}

interface TabItem {
  id: TabId;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  {
    id: 'party',
    label: 'Чек & Траты',
    iconName: 'receipt-outline',
    activeIconName: 'receipt',
  },
  {
    id: 'results',
    label: 'Итоги & Оплата',
    iconName: 'cash-outline',
    activeIconName: 'cash',
  },
  {
    id: 'profile',
    label: 'Профили СБП',
    iconName: 'people-outline',
    activeIconName: 'people',
  },
  {
    id: 'history',
    label: 'Архив',
    iconName: 'time-outline',
    activeIconName: 'time',
  },
];

export const TabBar: React.FC<TabBarProps> = ({
  currentTab,
  onSelectTab,
  itemsBadgeCount = 0,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handlePress = (tabId: TabId) => {
    try {
      Haptics.selectionAsync();
    } catch {
      // Haptics fallback
    }
    onSelectTab(tabId);
  };

  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.surfaceBorder,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.innerBar}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              onPress={() => handlePress(tab.id)}
              style={styles.tabButton}
            >
              <View
                style={[
                  styles.iconWrapper,
                  isActive && {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              >
                <Ionicons
                  name={isActive ? tab.activeIconName : tab.iconName}
                  size={20}
                  color={isActive ? theme.colors.textInverse : theme.colors.textMuted}
                />
                {tab.id === 'party' && itemsBadgeCount > 0 && !isActive && (
                  <View
                    style={[
                      styles.badgeDot,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isActive
                    ? [styles.activeTabLabel, { color: theme.colors.primary }]
                    : [styles.inactiveTabLabel, { color: theme.colors.textMuted }],
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  innerBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  iconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
  activeTabLabel: {
    fontWeight: '700',
  },
  inactiveTabLabel: {
    fontWeight: '500',
  },
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
