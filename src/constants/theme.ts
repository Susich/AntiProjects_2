/**
 * Theme tokens and color palette for PartySplit.
 * Deep obsidian dark theme with cyber neon accents.
 */

export const THEME = {
  colors: {
    // Backgrounds
    background: '#0B0F17',
    backgroundSecondary: '#0F1626',

    // Surfaces & Cards
    surface: '#131D31',
    surfaceElevated: '#1A2742',
    surfaceBorder: '#233554',
    surfaceBorderActive: '#3B82F6',

    // Neon Accents
    neonEmerald: '#00F5A0',
    emeraldDark: '#059669',
    neonCyan: '#00D2FF',
    neonViolet: '#8B5CF6',
    neonPink: '#F43F5E',
    neonAmber: '#F59E0B',

    // Functional colors
    primary: '#10B981',       // Main CTA / Split color
    primaryLight: '#34D399',
    secondary: '#3B82F6',     // Secondary actions
    danger: '#EF4444',        // Deleting / Errors
    warning: '#F59E0B',       // Warnings
    info: '#06B6D4',          // Links / Info
    success: '#10B981',       // Paid / Done

    // Typography
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0B0F17',
    textHighlight: '#00F5A0',

    // Overlays
    overlay: 'rgba(5, 8, 15, 0.82)',
    glass: 'rgba(19, 29, 49, 0.75)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  borderRadius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    full: 9999,
  },

  typography: {
    headingXl: {
      fontSize: 26,
      fontWeight: '700' as const,
      color: '#F8FAFC',
      letterSpacing: -0.5,
    },
    headingLg: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: '#F8FAFC',
      letterSpacing: -0.3,
    },
    headingMd: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: '#F8FAFC',
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
      color: '#F8FAFC',
      lineHeight: 22,
    },
    bodySecondary: {
      fontSize: 14,
      fontWeight: '400' as const,
      color: '#94A3B8',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: '#64748B',
    },
    monoNumber: {
      fontSize: 18,
      fontWeight: '700' as const,
      letterSpacing: 0.5,
    },
  },

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
};
