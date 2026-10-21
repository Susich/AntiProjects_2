import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode | ((props: { onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; dismiss: () => void }) => React.ReactNode);
  height?: number | string;
  maxHeight?: number | string;
  showHandle?: boolean;
  closeOnBackdrop?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
}

export const BottomSheetScrollContext = React.createContext<{
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  dismiss: () => void;
}>({
  onScroll: () => {},
  dismiss: () => {},
});

export const useBottomSheet = () => React.useContext(BottomSheetScrollContext);

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  height,
  maxHeight = '90%',
  showHandle = true,
  closeOnBackdrop = true,
  containerStyle,
  sheetStyle,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [isAtTop, setIsAtTop] = useState(true);

  const dismissSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [backdropOpacity, onClose, translateY]);

  // Animate in on visible
  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT * 0.7);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [backdropOpacity, translateY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // STRICT REQUIREMENT: Only capture when:
          // 1) modal scroll is strictly at the top (scrollTop === 0)
          // 2) movement vector is downward (deltaY > 0)
          // 3) vertical dominates horizontal (|dy| > 1.5 * |dx|)
          const isDown = gestureState.dy > 5;
          const isDominantlyVertical =
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
          return isAtTop && isDown && isDominantlyVertical;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          // Gesture capture started
        },
        onPanResponderMove: (_, gestureState) => {
          // Direct real-time 1-to-1 finger tracking without lag
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          } else {
            translateY.setValue(0);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          // Threshold: > 25% of height or fling velocity > 0.45
          const DISMISS_DISTANCE = SCREEN_HEIGHT * 0.25;
          const DISMISS_VELOCITY = 0.45;

          const isFling = gestureState.vy > DISMISS_VELOCITY;
          const isFarEnough = gestureState.dy > DISMISS_DISTANCE;

          if (isFling || isFarEnough) {
            dismissSheet();
          } else {
            // Soft spring bounce back to 0 position without jitter
            Animated.spring(translateY, {
              toValue: 0,
              tension: 130,
              friction: 12,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 130,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismissSheet, isAtTop, translateY]
  );

  // Dedicated pan responder for the drag handle area (always pulls down)
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          } else {
            translateY.setValue(0);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const DISMISS_DISTANCE = SCREEN_HEIGHT * 0.25;
          const DISMISS_VELOCITY = 0.45;
          if (
            gestureState.vy > DISMISS_VELOCITY ||
            gestureState.dy > DISMISS_DISTANCE
          ) {
            dismissSheet();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              tension: 130,
              friction: 12,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 130,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismissSheet, translateY]
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const atTop = e.nativeEvent.contentOffset.y <= 0.5;
      setIsAtTop((prev) => (prev !== atTop ? atTop : prev));
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      onScroll: handleScroll,
      dismiss: dismissSheet,
    }),
    [dismissSheet, handleScroll]
  );

  const resolvedHeight = useMemo(() => {
    if (height === 'auto') return undefined;
    const target = height ?? maxHeight ?? '88%';
    if (typeof target === 'number') return target;
    if (typeof target === 'string' && target.endsWith('%')) {
      const pct = parseFloat(target) / 100;
      return Math.round(SCREEN_HEIGHT * Math.min(pct, 0.94));
    }
    return Math.round(SCREEN_HEIGHT * 0.88);
  }, [height, maxHeight]);

  const resolvedMaxHeight = useMemo(() => {
    if (typeof maxHeight === 'number') return maxHeight;
    if (typeof maxHeight === 'string' && maxHeight.endsWith('%')) {
      const pct = parseFloat(maxHeight) / 100;
      return Math.round(SCREEN_HEIGHT * pct);
    }
    return Math.round(SCREEN_HEIGHT * 0.92);
  }, [maxHeight]);

  if (!visible) {
    return null;
  }

  const bottomInset =
    Platform.OS === 'web'
      ? ('max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)' as any)
      : Math.max(insets.bottom || 0, 16) + 12;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissSheet}
      statusBarTranslucent
    >
      <View style={[styles.rootOverlay, containerStyle]}>
        {/* Animated backdrop with velvet dim & blur on web */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: theme.colors.overlay,
              opacity: backdropOpacity,
            },
          ]}
        >
          {closeOnBackdrop && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismissSheet}
              accessibilityRole="button"
              accessibilityLabel="Закрыть окно"
            />
          )}
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          {/* Sliding sheet container with hardware-accelerated translateY */}
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.surfaceBorderActive,
                maxHeight: resolvedMaxHeight,
                ...(resolvedHeight != null ? { height: resolvedHeight } : {}),
                paddingBottom: bottomInset,
                transform: [{ translateY }],
              },
              sheetStyle,
            ]}
            {...panResponder.panHandlers}
          >
            {/* Top Drag Handle Bar */}
            {showHandle && (
              <View
                style={styles.handleHitbox}
                {...handlePanResponder.panHandlers}
                accessibilityRole="none"
              >
                <View
                  style={[
                    styles.handleBar,
                    { backgroundColor: `${theme.colors.textMuted}55` },
                  ]}
                />
              </View>
            )}

            {/* Sheet Body Content */}
            <BottomSheetScrollContext.Provider value={contextValue}>
              <View
                style={[
                  styles.contentWrap,
                  resolvedHeight == null && styles.contentWrapAuto,
                ]}
              >
                {typeof children === 'function'
                  ? children({
                      onScroll: handleScroll,
                      dismiss: dismissSheet,
                    })
                  : children}
              </View>
            </BottomSheetScrollContext.Provider>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: Platform.OS === 'web' ? 1.5 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1.5 : 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 20,
    ...(Platform.OS === 'web'
      ? ({
          overscrollBehaviorY: 'contain',
          contain: 'content',
        } as any)
      : {}),
  },
  handleHitbox: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleBar: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
  },
  contentWrap: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  contentWrapAuto: {
    flex: 0,
    minHeight: undefined,
  },
  contentWrapFlex: {
    flex: 1,
    minHeight: 0,
  },
});
