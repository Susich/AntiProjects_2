import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp, StyleSheet } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  formatter?: (val: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  prefix?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter,
  duration = 450,
  style,
  suffix = '',
  prefix = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = Date.now();
    const diff = endVal - startVal;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formattedText = formatter
    ? formatter(displayValue)
    : `${displayValue.toLocaleString('ru-RU')}`;

  return (
    <Text style={[styles.text, style]}>
      {prefix}
      {formattedText}
      {suffix}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});
