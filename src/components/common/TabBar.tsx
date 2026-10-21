import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { PressableScale } from './PressableScale';

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
    label: 'Профиль',
    iconName: 'person-outline',
    activeIconName: 'person',
  },
  {
    id: 'history',
    label: 'Архив',
    iconName: 'time-outline',
    activeIconName: 'time',
  },
];

const TabButtonItem: React.FC<{
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  itemsBadgeCount: number;
  theme: ThemeTokens;
  styles: ReturnType<typeof createStyles>;
}> = ({ tab, isActive, onPress, itemsBadgeCount, theme, styles }) => {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (isActive) {
      scaleAnim.setValue(0.88);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive, scaleAnim]);

  return (
    <PressableScale
      onPress={onPress}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
    >
      <Animated.View
        style={[
          styles.iconWrapper,
          isActive && styles.iconWrapperActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Ionicons
          name={isActive ? tab.activeIconName : tab.iconName}
          size={21}
          color={isActive ? theme.colors.textInverse : theme.colors.textMuted}
        />
        {tab.id === 'party' && itemsBadgeCount > 0 && !isActive && (
          <View style={styles.badgeDot} />
        )}
      </Animated.View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          styles.tabLabel,
          isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
          Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : undefined,
        ]}
      >
        {tab.label}
      </Text>
    </PressableScale>
  );
};

export const TabBar: React.FC<TabBarProps> = ({
  currentTab,
  onSelectTab,
  itemsBadgeCount = 0,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handlePress = (tabId: TabId) => {
    onSelectTab(tabId);
  };

  const safeBottomInset =
    Platform.OS === 'web'
      ? ('max(env(safe-area-inset-bottom, 0px), 16px)' as any)
      : Math.max(insets.bottom || 0, 12);

  return (
    <View
      style={[
        styles.barContainer,
        {
          paddingBottom: safeBottomInset,
          ...(Platform.OS === 'web'
            ? ({
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
                boxSizing: 'border-box',
              } as any)
            : {}),
        },
      ]}
    >
      <View style={styles.innerBar}>
        {TABS.map((tab) => (
          <TabButtonItem
            key={tab.id}
            tab={tab}
            isActive={currentTab === tab.id}
            onPress={() => handlePress(tab.id)}
            itemsBadgeCount={itemsBadgeCount}
            theme={theme}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    barContainer: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.surfaceBorder,
      paddingTop: 6,
      paddingHorizontal: 8,
      minHeight: 64,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    innerBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 52,
      width: '100%',
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      paddingVertical: 2,
      minWidth: 0,
    },
    iconWrapper: {
      width: 38,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
    },
    iconWrapperActive: {
      backgroundColor: theme.colors.primary,
    },
    tabLabel: {
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: -0.1,
      textAlign: 'center',
    },
    activeTabLabel: {
      fontWeight: '700',
      color: theme.colors.primary,
    },
    inactiveTabLabel: {
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    badgeDot: {
      position: 'absolute',
      top: 1,
      right: 6,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
  });
}
