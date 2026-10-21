import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeTokens, useTheme } from '../../context/ThemeContext';
import { registerGlobalToastListener } from '../../utils/toastBus';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [message, setMessage] = useState<string>('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [customIcon, setCustomIcon] = useState<keyof typeof Ionicons.glyphMap | undefined>(
    undefined
  );
  const [visible, setVisible] = useState(false);

  // Animated values are stable for the lifetime of the provider. Lazy state
  // initializers keep them out of refs, which must not be read during render.
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-24));
  const [scale] = useState(() => new Animated.Value(0.92));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string, options?: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setMessage(msg);
      setToastType(options?.type || 'success');
      setCustomIcon(options?.icon);
      setVisible(true);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 90,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 90,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();

      const duration = options?.duration || 3200;
      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -16,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.94,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setVisible(false);
        });
      }, duration);
    },
    [opacity, translateY, scale]
  );

  // Background writes report their final failures through this bridge so the
  // queue does not need to know about React context.
  useEffect(
    () =>
      registerGlobalToastListener((message, options) =>
        showToast(message, options as ToastOptions)
      ),
    [showToast]
  );

  const getBorderColor = () => {
    switch (toastType) {
      case 'success':
        return theme.colors.success;
      case 'info':
        return theme.colors.info;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.danger;
      default:
        return theme.colors.success;
    }
  };

  const getDefaultIcon = (): keyof typeof Ionicons.glyphMap => {
    if (customIcon) return customIcon;
    switch (toastType) {
      case 'success':
        return 'checkmark-circle';
      case 'info':
        return 'information-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'alert-circle';
      default:
        return 'checkmark-circle';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.container,
            {
              opacity,
              transform: [{ translateY }, { scale }],
              borderColor: getBorderColor(),
              top: insets.top + 8,
            },
          ]}
        >
          <Ionicons
            name={getDefaultIcon()}
            size={22}
            color={getBorderColor()}
            style={styles.icon}
          />
          <Text style={styles.text} numberOfLines={2}>
            {message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 20,
      right: 20,
      zIndex: 9999,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      ...theme.shadows.toast,
    },
    icon: {
      marginRight: 12,
    },
    text: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 19,
    },
  });
