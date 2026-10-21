import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBarStyle } from 'expo-status-bar';

export type ThemeId =
  | 'midnight'
  | 'cyberpunk'
  | 'craft'
  | 'light'
  | 'tokyoDrift'
  | 'nordicFjord'
  | 'duneAmber'
  | 'matchaForest'
  | 'monoInk'
  | 'sunsetMiami'
  | 'matrixCode'
  | 'deepAbyss'
  | 'espressoRoast'
  | 'bloodRuby';

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
      textSecondary: '#A89FC2',
      textMuted: '#8E82A8',
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

  // 5. "Tokyo Drift" (чернильно-фиолетовый, карточки #181424, неоновый лайм #A3E635, вспомогательный фиолетовый #8B5CF6)
  tokyoDrift: {
    id: 'tokyoDrift',
    name: 'Tokyo Drift',
    tagline: 'Чернильный ультрафиолет, неоновый лайм и ночной дрифт по Сибуе',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0D0B14',
      backgroundSecondary: '#130F20',
      surface: '#181424',
      surfaceElevated: '#231D36',
      surfaceBorder: '#2E2545',
      surfaceBorderActive: '#A3E635',

      primary: '#A3E635',
      primaryLight: '#BEF264',
      secondary: '#8B5CF6',
      accent: '#EC4899',
      neonEmerald: '#A3E635',
      neonCyan: '#38BDF8',
      neonPink: '#F43F5E',
      neonAmber: '#FBBF24',
      neonViolet: '#8B5CF6',

      danger: '#EF4444',
      warning: '#FBBF24',
      success: '#A3E635',
      info: '#8B5CF6',

      textPrimary: '#FAF5FF',
      textSecondary: '#C4B5FD',
      textMuted: '#7C6F99',
      textInverse: '#0D0B14',
      textHighlight: '#A3E635',

      overlay: 'rgba(8, 6, 15, 0.88)',
      glass: 'rgba(24, 20, 36, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#A3E635',
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

  // 6. "Nordic Fjord" (холодный сланцево-синий #0F172A, карточки #1E293B, ледяной циан #38BDF8, графит #64748B)
  nordicFjord: {
    id: 'nordicFjord',
    name: 'Nordic Fjord',
    tagline: 'Холодный скандинавский сланец, ледяной циан и чистота фьордов',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0F172A',
      backgroundSecondary: '#142038',
      surface: '#1E293B',
      surfaceElevated: '#28364F',
      surfaceBorder: '#334155',
      surfaceBorderActive: '#38BDF8',

      primary: '#38BDF8',
      primaryLight: '#7DD3FC',
      secondary: '#64748B',
      accent: '#0EA5E9',
      neonEmerald: '#34D399',
      neonCyan: '#38BDF8',
      neonPink: '#F43F5E',
      neonAmber: '#F59E0B',
      neonViolet: '#818CF8',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#38BDF8',
      info: '#0EA5E9',

      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      textInverse: '#0F172A',
      textHighlight: '#38BDF8',

      overlay: 'rgba(9, 14, 26, 0.88)',
      glass: 'rgba(30, 41, 59, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 4,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
        elevation: 8,
      },
    },
  },

  // 7. "Dune Amber" (теплый эспрессо #181512, карточки #26211C, насыщенный янтарь #F59E0B, терракота #FB7185)
  duneAmber: {
    id: 'duneAmber',
    name: 'Dune Amber',
    tagline: 'Теплый эспрессо, насыщенный янтарный акцент и бархатная терракота',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#181512',
      backgroundSecondary: '#201C18',
      surface: '#26211C',
      surfaceElevated: '#342D26',
      surfaceBorder: '#483E33',
      surfaceBorderActive: '#F59E0B',

      primary: '#F59E0B',
      primaryLight: '#FBBF24',
      secondary: '#FB7185',
      accent: '#F97316',
      neonEmerald: '#10B981',
      neonCyan: '#06B6D4',
      neonPink: '#FB7185',
      neonAmber: '#F59E0B',
      neonViolet: '#A855F7',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#06B6D4',

      textPrimary: '#FAF5EE',
      textSecondary: '#D5C7B7',
      textMuted: '#8C7E70',
      textInverse: '#181512',
      textHighlight: '#F59E0B',

      overlay: 'rgba(14, 12, 10, 0.88)',
      glass: 'rgba(38, 33, 28, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 9,
      },
    },
  },

  // 8. "Matcha Forest" (темно-хвойный #0B130E, карточки #15221A, акцентная мята #4ADE80, пастельная матча #86EFAC)
  matchaForest: {
    id: 'matchaForest',
    name: 'Matcha Forest',
    tagline: 'Глубокая хвойная тьма, акцентная свежая мята и пастельная матча',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0B130E',
      backgroundSecondary: '#101B14',
      surface: '#15221A',
      surfaceElevated: '#1D2E24',
      surfaceBorder: '#273F30',
      surfaceBorderActive: '#4ADE80',

      primary: '#4ADE80',
      primaryLight: '#86EFAC',
      secondary: '#86EFAC',
      accent: '#10B981',
      neonEmerald: '#4ADE80',
      neonCyan: '#2DD4BF',
      neonPink: '#F43F5E',
      neonAmber: '#F59E0B',
      neonViolet: '#A78BFA',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#4ADE80',
      info: '#2DD4BF',

      textPrimary: '#F0FDF4',
      textSecondary: '#BBF7D0',
      textMuted: '#688B74',
      textInverse: '#0B130E',
      textHighlight: '#4ADE80',

      overlay: 'rgba(6, 12, 8, 0.88)',
      glass: 'rgba(21, 34, 26, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#4ADE80',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 4,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 14,
        elevation: 8,
      },
    },
  },

  // 9. "Mono Ink" (чистый черный OLED #000000, карточки #171717 с тонкими контурами #2E2E2E, белый акцент #FFFFFF)
  monoInk: {
    id: 'monoInk',
    name: 'Mono Ink',
    tagline: 'Безупречный OLED black, строгие контуры и бескомпромиссный белый акцент',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#000000',
      backgroundSecondary: '#0A0A0A',
      surface: '#171717',
      surfaceElevated: '#222222',
      surfaceBorder: '#2E2E2E',
      surfaceBorderActive: '#FFFFFF',

      primary: '#FFFFFF',
      primaryLight: '#E5E5E5',
      secondary: '#A3A3A3',
      accent: '#D4D4D4',
      neonEmerald: '#FFFFFF',
      neonCyan: '#E5E5E5',
      neonPink: '#FFFFFF',
      neonAmber: '#E5E5E5',
      neonViolet: '#A3A3A3',

      danger: '#EF4444',
      warning: '#EAB308',
      success: '#22C55E',
      info: '#38BDF8',

      textPrimary: '#FFFFFF',
      textSecondary: '#A3A3A3',
      textMuted: '#737373',
      textInverse: '#000000',
      textHighlight: '#FFFFFF',

      overlay: 'rgba(0, 0, 0, 0.92)',
      glass: 'rgba(23, 23, 23, 0.9)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 4,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.7,
        shadowRadius: 14,
        elevation: 8,
      },
    },
  },

  // 10. "Miami Sunset" (ретровейв закат, неоновый розовый и золотой апельсин)
  sunsetMiami: {
    id: 'sunsetMiami',
    name: 'Miami Sunset',
    tagline: 'Ретровейв закат в Майами: неоновый фламинго, электрик-циан и золотой янтарь',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#0E091B',
      backgroundSecondary: '#150F28',
      surface: '#1D1438',
      surfaceElevated: '#291C4E',
      surfaceBorder: '#3D2B6E',
      surfaceBorderActive: '#FF2A85',

      primary: '#FF2A85',
      primaryLight: '#FF63A5',
      secondary: '#FFA834',
      accent: '#00F0FF',
      neonEmerald: '#05FFA1',
      neonCyan: '#00F0FF',
      neonPink: '#FF2A85',
      neonAmber: '#FFA834',
      neonViolet: '#B026FF',

      danger: '#FF3366',
      warning: '#FFA834',
      success: '#05FFA1',
      info: '#00F0FF',

      textPrimary: '#FFF0F7',
      textSecondary: '#FF80BF',
      textMuted: '#8E76A8',
      textInverse: '#0E091B',
      textHighlight: '#FFA834',

      overlay: 'rgba(10, 6, 20, 0.88)',
      glass: 'rgba(29, 20, 56, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#FF2A85',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.65,
        shadowRadius: 16,
        elevation: 10,
      },
    },
  },

  // 11. "Matrix Code" (терминал хакера, неоновый зелёный люминофор)
  matrixCode: {
    id: 'matrixCode',
    name: 'Matrix Code',
    tagline: 'Терминал хакера: фосфорный зелёный люминофор и глубокий чёрный мейнфрейм',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#070C08',
      backgroundSecondary: '#0C140E',
      surface: '#111D14',
      surfaceElevated: '#17281B',
      surfaceBorder: '#233E29',
      surfaceBorderActive: '#00FF66',

      primary: '#00FF66',
      primaryLight: '#5CFF9E',
      secondary: '#00E5FF',
      accent: '#ADFF2F',
      neonEmerald: '#00FF66',
      neonCyan: '#00E5FF',
      neonPink: '#FF007F',
      neonAmber: '#FFD700',
      neonViolet: '#9D4EDD',

      danger: '#FF3B30',
      warning: '#FFD700',
      success: '#00FF66',
      info: '#00E5FF',

      textPrimary: '#E8FFE8',
      textSecondary: '#5CFF9E',
      textMuted: '#587D60',
      textInverse: '#070C08',
      textHighlight: '#ADFF2F',

      overlay: 'rgba(5, 10, 6, 0.9)',
      glass: 'rgba(17, 29, 20, 0.85)',
    },
    borderRadius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#00FF66',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.7,
        shadowRadius: 16,
        elevation: 10,
      },
    },
  },

  // 12. "Deep Abyss" (океанская бездна, биолюминесцентная лазурь)
  deepAbyss: {
    id: 'deepAbyss',
    name: 'Deep Abyss',
    tagline: 'Марианская впадина: биолюминесцентный лазурный аквамарин и морская глубина',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#040E17',
      backgroundSecondary: '#081724',
      surface: '#0D2235',
      surfaceElevated: '#13304A',
      surfaceBorder: '#1E4566',
      surfaceBorderActive: '#00E5FF',

      primary: '#00E5FF',
      primaryLight: '#66EFFF',
      secondary: '#00FFA3',
      accent: '#38BDF8',
      neonEmerald: '#00FFA3',
      neonCyan: '#00E5FF',
      neonPink: '#FF5E7E',
      neonAmber: '#FFB800',
      neonViolet: '#818CF8',

      danger: '#FF4D6D',
      warning: '#FFB800',
      success: '#00FFA3',
      info: '#00E5FF',

      textPrimary: '#F0FDFE',
      textSecondary: '#38BDF8',
      textMuted: '#527E9F',
      textInverse: '#040E17',
      textHighlight: '#00FFA3',

      overlay: 'rgba(3, 11, 18, 0.88)',
      glass: 'rgba(13, 34, 53, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#00E5FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.65,
        shadowRadius: 16,
        elevation: 10,
      },
    },
  },

  // 13. "Espresso Roast" (уютная спешелти кофейня, тёмный шоколад и карамель)
  espressoRoast: {
    id: 'espressoRoast',
    name: 'Espresso Roast',
    tagline: 'Атмосфера спешелти кофейни: тёмный шоколад, карамельная пенка и тёплый янтарь',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#120E0B',
      backgroundSecondary: '#19130F',
      surface: '#231B15',
      surfaceElevated: '#31251E',
      surfaceBorder: '#48372C',
      surfaceBorderActive: '#E5A96A',

      primary: '#E5A96A',
      primaryLight: '#F3C89B',
      secondary: '#C48248',
      accent: '#F59E0B',
      neonEmerald: '#10B981',
      neonCyan: '#38BDF8',
      neonPink: '#E11D48',
      neonAmber: '#F59E0B',
      neonViolet: '#A855F7',

      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#38BDF8',

      textPrimary: '#FFF8F0',
      textSecondary: '#E5A96A',
      textMuted: '#8C7765',
      textInverse: '#120E0B',
      textHighlight: '#F59E0B',

      overlay: 'rgba(14, 10, 8, 0.88)',
      glass: 'rgba(35, 27, 21, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#E5A96A',
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

  // 14. "Blood Ruby" (готический нуар, кроваво-рубиновый неон и аметист)
  bloodRuby: {
    id: 'bloodRuby',
    name: 'Blood Ruby',
    tagline: 'Драматичный нуар: кроваво-рубиновый неон, спелая слива и аметист',
    statusBarStyle: 'light',
    isDark: true,
    colors: {
      background: '#120911',
      backgroundSecondary: '#1A0E19',
      surface: '#241423',
      surfaceElevated: '#321B30',
      surfaceBorder: '#4B2849',
      surfaceBorderActive: '#FF2E63',

      primary: '#FF2E63',
      primaryLight: '#FF6B8B',
      secondary: '#C084FC',
      accent: '#F43F5E',
      neonEmerald: '#10B981',
      neonCyan: '#38BDF8',
      neonPink: '#FF2E63',
      neonAmber: '#F59E0B',
      neonViolet: '#C084FC',

      danger: '#FF2E63',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#38BDF8',

      textPrimary: '#FFF1F4',
      textSecondary: '#FF7E9C',
      textMuted: '#8F6689',
      textInverse: '#120911',
      textHighlight: '#C084FC',

      overlay: 'rgba(14, 7, 13, 0.9)',
      glass: 'rgba(36, 20, 35, 0.85)',
    },
    borderRadius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, full: 9999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    shadows: {
      neonGreen: {
        shadowColor: '#FF2E63',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 6,
      },
      card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
        elevation: 5,
      },
      toast: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.65,
        shadowRadius: 16,
        elevation: 10,
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
