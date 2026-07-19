export const COLORS = {
  neonCyan: '#00f3ff',
  neonPink: '#ff007f',
  neonYellow: '#ffea00',
  neonGreen: '#39ff14',
  bgColor: '#06060c',
  textColor: '#e2e8f0',
  glassBg: 'rgba(10, 10, 20, 0.75)',
  glassBorder: 'rgba(0, 243, 255, 0.15)',

  accentWhite: '#ffffff',
  accentDeep: '#0d0d24',
  accentPurple: '#a855f7',

  neonCyanRGB: '0, 243, 255',
  neonPinkRGB: '255, 0, 127',
  neonYellowRGB: '255, 234, 0',
  neonGreenRGB: '57, 255, 20',
  bgColorRGB: '6, 6, 12',
  textColorRGB: '226, 232, 240',
  accentWhiteRGB: '255, 255, 255',
};

export const CANVAS_GLOW = {
  low: 15,
  medium: 20,
  high: 25,
};

export const FONTS = {
  cyber: "'Orbitron', sans-serif",
  body: "'Inter', sans-serif",
};

export const FONT_SIZES = {
  headline: '3rem',
  value: '1.5rem',
  label: '0.7rem',
  body: '0.9rem',
  small: '0.75rem',
  notification: '2rem',
  button: '1.1rem',
};

export const FONT_WEIGHTS = {
  regular: 400,
  semibold: 600,
  bold: 700,
  black: 900,
};

export const LETTER_SPACING = {
  tight: '1px',
  normal: '2px',
  wide: '4px',
  xwide: '6px',
};

export const BORDER_RADIUS = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '16px',
  xl: '20px',
  full: '50%',
};

export const CSS_GLOW = {
  textShadow: {
    cyan: {
      hud: '0 0 10px rgba(0, 243, 255, 0.5)',
      title: '0 0 10px rgba(0, 243, 255, 0.8), 0 0 20px rgba(0, 243, 255, 0.4), 0 0 30px rgba(0, 243, 255, 0.2)',
      button: '0 0 15px rgba(0, 243, 255, 0.3)',
      tagline: '0 0 8px rgba(0, 243, 255, 0.5)',
    },
    pink: {
      hud: '0 0 10px rgba(255, 0, 127, 0.5)',
      tagline: '0 0 8px rgba(255, 0, 127, 0.5)',
      title: '0 0 15px rgba(255, 0, 127, 0.8)',
      statHighlight: '0 0 8px rgba(255, 0, 127, 0.4)',
    },
    yellow: {
      hud: '0 0 10px rgba(255, 234, 0, 0.5)',
      notification: '0 0 15px rgba(255, 234, 0, 0.8)',
      highScore: '0 0 5px rgba(255, 234, 0, 0.3)',
    },
    green: {
      notification: '0 0 15px rgba(57, 255, 20, 0.8)',
    },
  },
  boxShadow: {
    panelBase: '0 0 40px rgba(0, 243, 255, 0.1), inset 0 0 20px rgba(0, 243, 255, 0.05)',
    panelGameOver: '0 0 40px rgba(255, 0, 127, 0.15)',
    panelPause: '0 0 40px rgba(255, 234, 0, 0.1)',
    buttonPrimary: '0 0 15px rgba(0, 243, 255, 0.3)',
    buttonHover: '0 0 25px rgba(0, 243, 255, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.3)',
    buttonActive: '0 0 10px rgba(0, 243, 255, 0.4)',
    buttonPink: '0 0 15px rgba(255, 0, 127, 0.3)',
    hudPulse0: '0 0 35px rgba(0, 243, 255, 0.08), inset 0 0 15px rgba(0, 243, 255, 0.02)',
    hudPulse100: '0 0 50px rgba(255, 0, 127, 0.12), inset 0 0 25px rgba(255, 0, 127, 0.04)',
  },
};

export const PANEL = {
  hudGroup: {
    background: 'rgba(10, 10, 20, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    backdropFilter: 'blur(5px)',
    padding: '10px 18px',
  },
  menuPanel: {
    background: COLORS.glassBg,
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: BORDER_RADIUS.lg,
    backdropFilter: 'blur(12px)',
    padding: '40px',
    maxWidth: '480px',
    glowPulse: 'panelGlowPulse 4s infinite alternate',
  },
  boostContainer: {
    background: 'rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
  },
  hudBtn: {
    background: 'rgba(10, 10, 20, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: '8px 14px',
    fontFamily: FONTS.cyber,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.tight,
    textTransform: 'uppercase',
  },
  audioBtn: {
    background: COLORS.glassBg,
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: BORDER_RADIUS.full,
    width: '40px',
    height: '40px',
  },
};
