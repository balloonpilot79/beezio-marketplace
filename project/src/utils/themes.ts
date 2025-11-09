// Theme configurations for seller and affiliate stores
export const themes = {
  modern: {
    name: 'Modern',
    colors: {
      primary: '#ffcc00',
      secondary: '#000000',
      background: '#ffffff',
      text: '#1f2937',
      border: '#e5e7eb'
    },
    fonts: {
      heading: "'Poppins', sans-serif",
      body: "'Inter', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'rounded-xl shadow-lg hover:shadow-xl transition-shadow',
    buttonStyle: 'bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors'
  },
  minimal: {
    name: 'Minimal',
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
      background: '#fafafa',
      text: '#000000',
      border: '#d4d4d4'
    },
    fonts: {
      heading: "'Helvetica Neue', sans-serif",
      body: "'Helvetica Neue', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'border border-black hover:bg-black hover:text-white transition-all',
    buttonStyle: 'bg-black text-white border-2 border-black hover:bg-white hover:text-black transition-all'
  },
  vibrant: {
    name: 'Vibrant',
    colors: {
      primary: '#ef4444',
      secondary: '#8b5cf6',
      background: '#fef2f2',
      text: '#1f2937',
      border: '#fecaca'
    },
    fonts: {
      heading: "'Montserrat', sans-serif",
      body: "'Open Sans', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'rounded-2xl bg-white shadow-md hover:shadow-2xl hover:scale-105 transition-all',
    buttonStyle: 'bg-gradient-to-r from-red-500 to-purple-600 text-white font-bold rounded-full hover:from-red-600 hover:to-purple-700 transition-all'
  },
  elegant: {
    name: 'Elegant',
    colors: {
      primary: '#1e293b',
      secondary: '#d4af37',
      background: '#f8fafc',
      text: '#334155',
      border: '#cbd5e1'
    },
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Lato', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow',
    buttonStyle: 'bg-slate-800 text-white font-semibold rounded hover:bg-slate-900 transition-colors'
  },
  nature: {
    name: 'Nature',
    colors: {
      primary: '#059669',
      secondary: '#84cc16',
      background: '#f0fdf4',
      text: '#064e3b',
      border: '#bbf7d0'
    },
    fonts: {
      heading: "'Merriweather', serif",
      body: "'Source Sans Pro', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow',
    buttonStyle: 'bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors'
  },
  tech: {
    name: 'Tech',
    colors: {
      primary: '#3b82f6',
      secondary: '#06b6d4',
      background: '#f1f5f9',
      text: '#0f172a',
      border: '#cbd5e1'
    },
    fonts: {
      heading: "'Space Grotesk', sans-serif",
      body: "'Inter', sans-serif"
    },
    layout: 'grid',
    cardStyle: 'rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 shadow-md hover:shadow-xl transition-all',
    buttonStyle: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all'
  }
};

export type ThemeName = keyof typeof themes;

export interface ThemeSettings {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  layout?: 'grid' | 'list' | 'masonry';
}

export const getThemeStyles = (themeName: ThemeName, customSettings?: ThemeSettings) => {
  const theme = themes[themeName] || themes.modern;
  
  // Merge theme with custom settings if provided
  if (customSettings) {
    return {
      ...theme,
      colors: {
        ...theme.colors,
        primary: customSettings.primary_color || theme.colors.primary,
        secondary: customSettings.secondary_color || theme.colors.secondary
      },
      fonts: {
        ...theme.fonts,
        heading: customSettings.font_family || theme.fonts.heading,
        body: customSettings.font_family || theme.fonts.body
      },
      layout: customSettings.layout || theme.layout
    };
  }
  
  return theme;
};

export const applyThemeToDocument = (themeName: ThemeName, customSettings?: ThemeSettings) => {
  const theme = getThemeStyles(themeName, customSettings);
  
  // Apply CSS custom properties to document root
  document.documentElement.style.setProperty('--color-primary', theme.colors.primary);
  document.documentElement.style.setProperty('--color-secondary', theme.colors.secondary);
  document.documentElement.style.setProperty('--color-background', theme.colors.background);
  document.documentElement.style.setProperty('--color-text', theme.colors.text);
  document.documentElement.style.setProperty('--color-border', theme.colors.border);
  document.documentElement.style.setProperty('--font-heading', theme.fonts.heading);
  document.documentElement.style.setProperty('--font-body', theme.fonts.body);
};

export const getLayoutClass = (layout: string) => {
  switch (layout) {
    case 'grid':
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
    case 'list':
      return 'flex flex-col gap-4';
    case 'masonry':
      return 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6';
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
  }
};
