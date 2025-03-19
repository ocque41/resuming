/**
 * CV Optimizer Design System
 * 
 * A luxurious, premium dark theme design system inspired by high-end brands
 * with a focus on subtle details, refined typography, and elegant interactions.
 */

// Core colors
export const colors = {
  // Dark shades - primary backgrounds
  dark: {
    pure: '#050505',      // Pure black background
    soft: '#0A0A0A',      // Slightly lighter black for layering
    medium: '#111111',    // Medium dark for cards
    accent: '#161616',    // Accent dark for hover states
    highlight: '#1D1D1D', // Highlight dark for active states
  },
  
  // Neutral grays - borders and dividers
  neutral: {
    darkest: '#222222',   // Darkest border color
    darker: '#282828',    // Darker border color for subtle separation
    dark: '#333333',      // Primary border color
    medium: '#444444',    // Medium border for contrast
    light: '#555555',     // Light border for emphasis
  },
  
  // Text colors
  text: {
    primary: '#F9F6EE',   // Primary text color (bone white)
    secondary: '#E2DFD7', // Secondary text (slightly darker bone white)
    tertiary: '#C5C2BA',  // Tertiary text (muted bone white)
    subtle: '#8A8782',    // Subtle text (gray with bone undertone)
    disabled: '#5C5A57',  // Disabled text
  },
  
  // Brand accent
  accent: {
    primary: '#B4916C',   // Primary accent color
    hover: '#C5A280',     // Lighter accent for hover
    active: '#A38160',    // Darker accent for active/pressed states
    subtle: 'rgba(180, 145, 108, 0.15)', // Subtle accent for backgrounds
    muted: 'rgba(180, 145, 108, 0.07)',  // Very subtle accent
  },
  
  // Feedback colors
  feedback: {
    // Success colors
    success: {
      background: '#0D1F15',
      border: '#1A4332',
      text: '#4ADE80',
      icon: '#2ECC71',
    },
    // Error colors
    error: {
      background: '#1A0505',
      border: '#3D1A1A',
      text: '#F5C2C2',
      icon: '#E74C3C',
    },
    // Warning colors
    warning: {
      background: '#1A140A',
      border: '#3D321A',
      text: '#FCD34D',
      icon: '#F39C12',
    },
    // Info colors
    info: {
      background: '#071A2E',
      border: '#12345E',
      text: '#90CDF4',
      icon: '#3498DB',
    },
  },
};

// Shadows
export const shadows = {
  subtle: '0 1px 3px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.3)',
  medium: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
  large: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.15)',
  focus: '0 0 0 2px rgba(180, 145, 108, 0.6)',
};

// Gradients
export const gradients = {
  subtle: `linear-gradient(to bottom right, ${colors.dark.soft}, ${colors.dark.pure})`,
  cardTop: `linear-gradient(to bottom, ${colors.dark.accent}, ${colors.dark.medium})`,
  cardBottom: `linear-gradient(to top, ${colors.dark.accent}, ${colors.dark.medium})`,
  accentSubtle: `linear-gradient(to right, ${colors.accent.primary}, ${colors.accent.hover})`,
  darkGlass: `linear-gradient(to bottom right, rgba(26, 26, 26, 0.7), rgba(13, 13, 13, 0.7))`,
};

// Border radius
export const radius = {
  xs: '0.25rem',  // 4px
  sm: '0.375rem', // 6px
  md: '0.5rem',   // 8px
  lg: '0.75rem',  // 12px
  xl: '1rem',     // 16px
  xxl: '1.5rem',  // 24px
  full: '9999px', // Full rounded (for circles)
};

// Spacing
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  base: '1rem',    // 16px
  lg: '1.25rem',   // 20px
  xl: '1.5rem',    // 24px
  xxl: '2rem',     // 32px
  xxxl: '2.5rem',  // 40px
  xxxxl: '3rem',   // 48px
};

// Font sizes
export const fontSize = {
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem',  // 36px
  '5xl': '3rem',     // 48px
};

// Font weights
export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

// Line heights
export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

// Animation timing
export const animation = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  extraSlow: '800ms',
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
}; 