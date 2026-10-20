import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBarStyle } from 'expo-status-bar';

export type ThemeId = 'midnight' | 'cyberpunk' | 'craft' | 'light';

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  tagline: string;
  statusBarStyle: StatusBarStyle;
  isDark: boolean;
  colors: {
    // Backgrounds
    background: string;
    backgroundSecondary: string;

    // Surfaces & Cards
    surface: string;
    surfaceElevated: string;
    surfaceBorder: string;
    surfaceBorderActive: string;

    // Accents & Neons
    primary: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    neonEmerald: string;
    neonCyan: string;
    neonPink: string;
    neonAmber: string;
    neonViolet: string;

    // Functional
    danger: string;
    warning: string;
    success: string;
    info: string;

    // Typography
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    textHighlight: string;

    // Overlays
    overlay: string;
    glass: string;
  };
  borderRadius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  shadows: {
    neonGreen: object;
    card: object;
    toast: object;
  };
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  // 1. "Midnight Bar" (тёмная, неоново-фиолетовые и янтарные акценты)
  midnight: {
    id: 'midnight',
    name: 'Midnight Bar',
    tagline: 'Атмосфера ночного лаунж-бара, фиолетовый неон и тёплый янтарь',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0D0B18',
      backgroundSecondary: '#131024',
      surface: '#1A1630',
      surfaceElevated: '#241E42',
      surfaceBorder: '#362D5E',
      surfaceBorderActive: '#A855F7',

      primary: '#A855F7',
      primaryLight: '#C084FC',
      secondary: '#F59E0B',
      accent: '#EC4899',
      neonEmerald: '#10B981',
      neonCyan: '#38BDF8',
      neonPink: '#F43F5E',
      neonAmber: '#F59E0B',
      neonViolet: '#A855F7',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#38BDF8',

      textPrimary: '#FAF5FF',
      textSecondary: '#C084FC',
      textMuted: '#7E6B9B',
      textInverse: '#0D0B18',
      textHighlight: '#F59E0B',

      overlay: 'rgba(7, 5, 15, 0.85)',
      glass: 'rgba(26, 22, 48, 0.8)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 10,
      },
    },
  },

  // 2. "Cyberpunk / Neon" (глубокий чёрный, неоновый зелёный и едкий розовый)
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    tagline: 'Глубокий чёрный обсидиан, изумрудный лазер и едкий неоновый розовый',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0B0F17',
      backgroundSecondary: '#0F1626',
      surface: '#131D31',
      surfaceElevated: '#1A2742',
      surfaceBorder: '#233554',
      surfaceBorderActive: '#00D2FF',

      primary: '#00F5A0',
      primaryLight: '#34D399',
      secondary: '#00D2FF',
      accent: '#F43F5E',
      neonEmerald: '#00F5A0',
      neonCyan: '#00D2FF',
      neonPink: '#F43F5E',
      neonAmber: '#F59E0B',
      neonViolet: '#8B5CF6',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#00F5A0',
      info: '#00D2FF',

      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      textInverse: '#0B0F17',
      textHighlight: '#00F5A0',

      overlay: 'rgba(5, 8, 15, 0.85)',
      glass: 'rgba(19, 29, 49, 0.8)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#00F5A0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 10,
      },
    },
  },

  // 3. "Craft Minimal" (матовый серый, акцент под крафтовую бумагу / тёплый оранжевый)
  craft: {
    id: 'craft',
    name: 'Craft Minimal',
    tagline: 'Матовый графит, тёплый крафтовый оранжевый и уютная эстетика кофейни',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#181615',
      backgroundSecondary: '#211E1C',
      surface: '#2B2724',
      surfaceElevated: '#38332F',
      surfaceBorder: '#4F4741',
      surfaceBorderActive: '#EA580C',

      primary: '#EA580C',
      primaryLight: '#FB923C',
      secondary: '#D97706',
      accent: '#FBBF24',
      neonEmerald: '#10B981',
      neonCyan: '#06B6D4',
      neonPink: '#F43F5E',
      neonAmber: '#F59E0B',
      neonViolet: '#A855F7',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#06B6D4',

      textPrimary: '#F5F5F4',
      textSecondary: '#D6D3D1',
      textMuted: '#8C827A',
      textInverse: '#181615',
      textHighlight: '#FB923C',

      overlay: 'rgba(12, 11, 10, 0.85)',
      glass: 'rgba(43, 39, 36, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#EA580C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 5,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 4,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
        elevation: 8,
      },
    },
  },

  // 4. "Clean Light" (аккуратная светлая тема)
  light: {
    id: 'light',
    name: 'Clean Light',
    tagline: 'Минималистичная светлая тема с кристальной контрастностью и мягкими тенями',
    statusBarStyle: 'dark',
    isDark: false,
    colors: {
      background: '#F8FAFC',
      backgroundSecondary: '#EDF2F7',
      surface: '#FFFFFF',
      surfaceElevated: '#F1F5F9',
      surfaceBorder: '#CBD5E1',
      surfaceBorderActive: '#0284C7',

      primary: '#0284C7',
      primaryLight: '#38BDF8',
      secondary: '#0D9488',
      accent: '#E11D48',
      neonEmerald: '#059669',
      neonCyan: '#0284C7',
      neonPink: '#E11D48',
      neonAmber: '#D97706',
      neonViolet: '#7C3AED',

      danger: '#DC2626',
      warning: '#D97706',
      success: '#059669',
      info: '#0284C7',

      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#94A3B8',
      textInverse: '#FFFFFF',
      textHighlight: '#0284C7',

      overlay: 'rgba(15, 23, 42, 0.65)',
      glass: 'rgba(255, 255, 255, 0.88)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
      card: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
      },
      toast: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 8,
      },
    },
  },
};

const THEME_STORAGE_KEY = '@partysplit:theme_id';

interface ThemeContextType {
  theme: ThemeTokens;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  availableThemes: ThemeTokens[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.cyberpunk,
  themeId: 'cyberpunk',
  setThemeId: () => {},
  availableThemes: Object.values(THEMES),
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>('cyberpunk');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved && (saved in THEMES)) {
          setThemeIdState(saved as ThemeId);
        }
      })
      .catch((err) => console.warn('[ThemeContext] Failed to load theme:', err));
  }, []);

  const setThemeId = (newId: ThemeId) => {
    if (newId in THEMES) {
      setThemeIdState(newId);
      AsyncStorage.setItem(THEME_STORAGE_KEY, newId).catch((err) =>
        console.warn('[ThemeContext] Failed to save theme:', err)
      );
    }
  };

  const value = {
    theme: THEMES[themeId] || THEMES.cyberpunk,
    themeId,
    setThemeId,
    availableThemes: Object.values(THEMES),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
