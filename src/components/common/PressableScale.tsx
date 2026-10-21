import React, { useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { triggerImpact } from '../../utils/haptics';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  haptic?: boolean;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  activeScale = 0.95,
  haptic = true,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  hitSlop,
}) => {
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (disabled) return;
    if (haptic) {
      void triggerImpact();
    }
    Animated.spring(scale, {
      toValue: activeScale,
      tension: 260,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
