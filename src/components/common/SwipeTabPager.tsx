import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { TabId } from './TabBar';

interface SwipeTabPagerProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  children: React.ReactNode;
}

const ORDERED_TABS: TabId[] = ['party', 'results', 'profile', 'history'];

export const SwipeTabPager: React.FC<SwipeTabPagerProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const prevTabRef = useRef<TabId | null>(null);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [opacityAnim] = useState(() => new Animated.Value(1));
  const [dragAnim] = useState(() => new Animated.Value(0));
  const [combinedTranslateX] = useState(() => Animated.add(slideAnim, dragAnim));

  // Track tab index changes for hardware-accelerated slide direction
  useEffect(() => {
    const prevTab = prevTabRef.current;
    prevTabRef.current = currentTab;

    if (prevTab && prevTab !== currentTab) {
      const prevIndex = ORDERED_TABS.indexOf(prevTab);
      const newIndex = ORDERED_TABS.indexOf(currentTab);

      // Determine natural slide direction:
      // 1: entering from right (+30px to 0)
      // -1: entering from left (-30px to 0)
      let direction: number;
      if (prevIndex === ORDERED_TABS.length - 1 && newIndex === 0) {
        // Circular forward wrap: last tab -> first tab enters from right
        direction = 1;
      } else if (prevIndex === 0 && newIndex === ORDERED_TABS.length - 1) {
        // Circular backward wrap: first tab -> last tab enters from left
        direction = -1;
      } else {
        direction = newIndex >= prevIndex ? 1 : -1;
      }

      slideAnim.setValue(direction * 30);
      opacityAnim.setValue(0.35);

      // Start animation on next frame via requestAnimationFrame to guarantee smooth 60 FPS
      const rafId = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 240,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 190,
            friction: 16,
            useNativeDriver: true,
          }),
        ]).start();
      });

      return () => cancelAnimationFrame(rafId);
    }
  }, [currentTab, opacityAnim, slideAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Filter gestures:
          // 1) |dx| > 20px threshold to prevent jitter
          // 2) |dx| > 1.73 * |dy| (angle <= 30 degrees) to NEVER block vertical content scroll
          const isHorizontal =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.73;
          const isSignificant = Math.abs(gestureState.dx) > 20;
          return isHorizontal && isSignificant;
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: () => {
          dragAnim.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          // Real-time finger tracking with soft resistance
          dragAnim.setValue(gestureState.dx * 0.42);
        },
        onPanResponderRelease: (_, gestureState) => {
          const SWIPE_THRESHOLD = 45;
          const SWIPE_VELOCITY = 0.3;

          const currentIndex = ORDERED_TABS.indexOf(currentTab);
          const isQuick = Math.abs(gestureState.vx) > SWIPE_VELOCITY;
          const isFar = Math.abs(gestureState.dx) > SWIPE_THRESHOLD;

          if (isFar || isQuick) {
            if (gestureState.dx < 0) {
              // Swipe Left (finger moves left) -> next tab (circular: 3 -> 0)
              const nextIndex = (currentIndex + 1) % ORDERED_TABS.length;
              onSelectTab(ORDERED_TABS[nextIndex]);
            } else if (gestureState.dx > 0) {
              // Swipe Right (finger moves right) -> previous tab (circular: 0 -> 3)
              const prevIndex =
                (currentIndex - 1 + ORDERED_TABS.length) % ORDERED_TABS.length;
              onSelectTab(ORDERED_TABS[prevIndex]);
            }
          }

          // Return drag offset cleanly with spring
          Animated.spring(dragAnim, {
            toValue: 0,
            tension: 200,
            friction: 14,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragAnim, {
            toValue: 0,
            tension: 140,
            friction: 11,
            useNativeDriver: true,
          }).start();
        },
      }),
    [currentTab, dragAnim, onSelectTab]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.animatedContent,
          {
            opacity: opacityAnim,
            transform: [{ translateX: combinedTranslateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedContent: {
    flex: 1,
  },
});
