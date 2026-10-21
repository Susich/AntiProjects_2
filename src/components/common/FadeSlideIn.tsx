import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface FadeSlideInProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  slideDistance?: number;
  style?: StyleProp<ViewStyle>;
}

export const FadeSlideIn: React.FC<FadeSlideInProps> = ({
  children,
  index = 0,
  delay,
  duration = 260,
  slideDistance = 10,
  style,
}) => {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(slideDistance));

  useEffect(() => {
    const computedDelay = delay !== undefined ? delay : Math.min(index * 20, 200);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: computedDelay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 180,
        friction: 12,
        delay: computedDelay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay, duration, index, opacity, slideDistance, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
