import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useTheme } from '../../context/ThemeContext';
import { AppNotification, NotificationType } from '../../types';

interface InAppNotificationBannerProps {
  onPressNotification?: (notification: AppNotification) => void;
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null;

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  onPressNotification,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const activeNotification = useNotificationStore(
    (s) => s.activeInAppNotification
  );
  const dismissInApp = useNotificationStore((s) => s.dismissInApp);
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  const [translateY] = useState(() => new Animated.Value(-120));
  const [opacity] = useState(() => new Animated.Value(0));

  const cancelAutoDismiss = useCallback(() => {
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
  }, []);

  const handleSlideOut = useCallback(() => {
    cancelAutoDismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissInApp();
    });
  }, [translateY, opacity, dismissInApp, cancelAutoDismiss]);

  const startAutoDismiss = useCallback(() => {
    cancelAutoDismiss();
    bannerTimer = setTimeout(() => {
      handleSlideOut();
    }, 4500);
  }, [cancelAutoDismiss, handleSlideOut]);

  useEffect(() => {
    if (activeNotification) {
      translateY.setValue(-120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      startAutoDismiss();
    } else {
      cancelAutoDismiss();
    }

    return () => {
      cancelAutoDismiss();
    };
  }, [activeNotification, translateY, opacity, startAutoDismiss, cancelAutoDismiss]);

  // Touch gesture responder for swipe-to-dismiss upward
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only claim gesture if vertical drag is dominant
          return (
            Math.abs(gestureState.dy) > 4 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.8
          );
        },
        onPanResponderGrant: () => {
          // Pause auto-dismiss when user touches
          cancelAutoDismiss();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy < 0) {
            // Direct 1:1 finger tracking upward
            translateY.setValue(gestureState.dy);
          } else {
            // Rubberband resistance if pulled downward
            translateY.setValue(gestureState.dy * 0.25);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          // Threshold: 35px upward or velocity vy < -0.35
          if (gestureState.dy < -35 || gestureState.vy < -0.35) {
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: -150,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
              }),
            ]).start(() => {
              dismissInApp();
            });
          } else {
            // Bounce back to home position
            Animated.spring(translateY, {
              toValue: 0,
              friction: 7,
              tension: 80,
              useNativeDriver: true,
            }).start(() => {
              startAutoDismiss();
            });
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }).start();
          startAutoDismiss();
        },
      }),
    [translateY, opacity, dismissInApp, startAutoDismiss, cancelAutoDismiss]
  );

  if (!activeNotification) {
    return null;
  }

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'party_invite':
        return { name: 'sparkles' as const, color: theme.colors.neonCyan };
      case 'bill_change':
        return { name: 'receipt-outline' as const, color: theme.colors.primary };
      case 'payment_status':
        return { name: 'checkmark-circle' as const, color: theme.colors.success };
      case 'debt_reminder':
        return { name: 'alarm-outline' as const, color: theme.colors.warning };
      case 'party_closed':
        return { name: 'archive-outline' as const, color: theme.colors.info };
      default:
        return { name: 'notifications-outline' as const, color: theme.colors.primary };
    }
  };

  const iconMeta = getTypeIcon(activeNotification.type);

  const handlePress = () => {
    markAsRead(activeNotification.id);
    if (onPressNotification) {
      onPressNotification(activeNotification);
    }
    handleSlideOut();
  };

  const topOffset = (insets.top || (Platform.OS === 'web' ? 12 : 24)) + 6;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
          opacity,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.surfaceBorder,
          shadowColor: '#000000',
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.contentWrap}
        activeOpacity={0.88}
        onPress={handlePress}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: `${iconMeta.color}1E`, borderColor: `${iconMeta.color}35` },
          ]}
        >
          <Ionicons name={iconMeta.name} size={20} color={iconMeta.color} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, { color: theme.colors.textPrimary }]}
              numberOfLines={1}
            >
              {activeNotification.title}
            </Text>
            <Text style={[styles.timeLabel, { color: theme.colors.textMuted }]}>
              сейчас
            </Text>
          </View>
          <Text
            style={[styles.message, { color: theme.colors.textSecondary }]}
            numberOfLines={2}
          >
            {activeNotification.message}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleSlideOut}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Закрыть уведомление"
        >
          <Ionicons name="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Subtle swipe up hint handle */}
      <View style={styles.handleContainer}>
        <View
          style={[styles.handleBar, { backgroundColor: theme.colors.surfaceBorder }]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    maxWidth: Platform.OS === 'web' ? 490 : undefined,
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 99999,
    elevation: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  contentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 6,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    alignSelf: 'flex-start',
    marginTop: -2,
  },
  handleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 5,
  },
  handleBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
    opacity: 0.6,
  },
});
