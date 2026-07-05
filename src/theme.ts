import type { ColorSchemeName } from 'react-native';

export type AppTheme = ReturnType<typeof getTheme>;

export function getTheme(scheme: ColorSchemeName) {
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: {
      background: isDark ? '#0B0C0E' : '#F6F4EF',
      surface: isDark ? '#15171A' : '#FFFFFF',
      surfaceSubtle: isDark ? '#1D2024' : '#F0EDE6',
      text: isDark ? '#F4F1EA' : '#1C1A17',
      muted: isDark ? '#A6A19A' : '#746E66',
      faint: isDark ? '#2B2F34' : '#E3DED4',
      border: isDark ? '#30343A' : '#DED8CC',
      win: '#2FB66D',
      loss: '#D9514E',
      accent: isDark ? '#E7C46F' : '#7C5A1D',
      danger: '#E25D5A',
      tab: isDark ? '#111316' : '#FFFFFF'
    }
  };
}
