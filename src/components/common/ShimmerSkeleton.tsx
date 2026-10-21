import React, { useEffect, useState } from 'react';
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ShimmerSkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const ShimmerSkeleton: React.FC<ShimmerSkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { theme } = useTheme();
  const [anim] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceBorder,
          opacity: anim,
        },
        style,
      ]}
    />
  );
};

export const ExpenseCardSkeleton: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
      <View style={styles.row}>
        <ShimmerSkeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardInfo}>
          <ShimmerSkeleton width="60%" height={16} borderRadius={6} style={{ marginBottom: 6 }} />
          <ShimmerSkeleton width="40%" height={12} borderRadius={4} />
        </View>
        <ShimmerSkeleton width={70} height={20} borderRadius={6} />
      </View>
    </View>
  );
};

export const ProfileSkeleton: React.FC = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.surfaceBorder }]}>
      <ShimmerSkeleton width={64} height={64} borderRadius={32} style={{ marginBottom: 12, alignSelf: 'center' }} />
      <ShimmerSkeleton width="50%" height={20} borderRadius={6} style={{ marginBottom: 8, alignSelf: 'center' }} />
      <ShimmerSkeleton width="35%" height={14} borderRadius={4} style={{ alignSelf: 'center' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
});
