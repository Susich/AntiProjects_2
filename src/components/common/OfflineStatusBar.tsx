import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { useNetworkStatus } from '../../services/networkService';
import { flushOfflineQueue } from '../../api/cloudQueue';

export const OfflineStatusBar: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isOnline, isSyncing, lastSyncAt, pendingCount } = useNetworkStatus();

  const [showSyncedSuccess, setShowSyncedSuccess] = useState(false);
  const prevSyncingRef = useRef(isSyncing);
  const prevOnlineRef = useRef(isOnline);

  const [slideAnim] = useState(() => new Animated.Value(0));
  const [opacityAnim] = useState(() => new Animated.Value(0));

  // Track transition from syncing -> synced
  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && isOnline && lastSyncAt) {
      setShowSyncedSuccess(true);
      const timer = setTimeout(() => {
        setShowSyncedSuccess(false);
      }, 2600);
      return () => clearTimeout(timer);
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, isOnline, lastSyncAt]);

  // Track transition to online/offline
  useEffect(() => {
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const shouldBeVisible = !isOnline || isSyncing || showSyncedSuccess;

  useEffect(() => {
    if (shouldBeVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [shouldBeVisible, slideAnim, opacityAnim]);

  const maxHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 36],
  });

  const handleManualRetry = () => {
    if (isOnline) {
      flushOfflineQueue();
    }
  };

  // Determine current presentation mode
  let mode: 'offline' | 'syncing' | 'synced' = 'offline';
  if (showSyncedSuccess && isOnline) {
    mode = 'synced';
  } else if (isSyncing) {
    mode = 'syncing';
  }

  const getModeConfig = () => {
    switch (mode) {
      case 'offline':
        return {
          icon: 'cloud-offline-outline' as const,
          color: theme.colors.warning,
          bg: `${theme.colors.warning}14`,
          border: `${theme.colors.warning}35`,
          text: pendingCount > 0
            ? `Оффлайн-режим • ${pendingCount} в очереди`
            : 'Оффлайн-режим • изменения сохраняются локально',
        };
      case 'syncing':
        return {
          icon: 'sync-outline' as const,
          color: theme.colors.neonCyan,
          bg: `${theme.colors.neonCyan}14`,
          border: `${theme.colors.neonCyan}35`,
          text: pendingCount > 0
            ? `Синхронизация... (осталось ${pendingCount})`
            : 'Синхронизация с Google Таблицей...',
        };
      case 'synced':
        return {
          icon: 'checkmark-circle-outline' as const,
          color: theme.colors.success,
          bg: `${theme.colors.success}14`,
          border: `${theme.colors.success}35`,
          text: 'Данные синхронизированы',
        };
    }
  };

  const config = getModeConfig();

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          maxHeight,
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: config.bg,
            borderColor: config.border,
          },
        ]}
        activeOpacity={0.85}
        onPress={handleManualRetry}
        disabled={!isOnline || isSyncing}
      >
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text
          style={[styles.statusText, { color: config.color }]}
          numberOfLines={1}
        >
          {config.text}
        </Text>
        {!isOnline && pendingCount > 0 && (
          <View
            style={[styles.badgePill, { backgroundColor: config.color }]}
          >
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    wrapper: {
      width: '100%',
      overflow: 'hidden',
      zIndex: 900,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      gap: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    badgePill: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      marginLeft: 2,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.colors.textInverse,
    },
  });
}
