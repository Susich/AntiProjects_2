import React, { useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getAvatarColor, getInitials } from '../../utils/currency';

export interface AvatarProps {
  url?: string | null;
  name?: string;
  color?: string;
  size?: number;
  showEditBadge?: boolean;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  badgeColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  url,
  name = '',
  color,
  size = 40,
  showEditBadge = false,
  badgeIcon = 'camera',
  badgeColor,
  style,
  textStyle,
  onPress,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const initials = getInitials(name || 'Участник');
  const bgColor = color || (name ? getAvatarColor(name) : theme.colors.primary);
  const borderRadius = Math.round(size / 2);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const badgeSize = Math.max(18, Math.round(size * 0.32));
  const badgeIconSize = Math.max(10, Math.round(badgeSize * 0.6));

  const shouldRenderImage = Boolean(url && failedUri !== url);

  const content = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: shouldRenderImage ? theme.colors.surfaceElevated : bgColor,
        },
        style,
      ]}
    >
      {shouldRenderImage ? (
        <Image
          source={{ uri: url as string }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="cover"
          onError={() => {
            if (url) setFailedUri(url);
          }}
        />
      ) : (
        <Text
          style={[
            styles.initialsText,
            { fontSize, lineHeight: fontSize * 1.2 },
            textStyle,
          ]}
          numberOfLines={1}
        >
          {initials}
        </Text>
      )}

      {showEditBadge && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badgeColor || theme.colors.primary,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          <Ionicons name={badgeIcon} size={badgeIconSize} color="#FFFFFF" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || (name ? `Аватар пользователя ${name}` : 'Аватар')}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  image: {
    overflow: 'hidden',
  },
  initialsText: {
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
