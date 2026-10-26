/**
 * TOKENS DE DISEÑO PROVISIONALES de Prolac.
 *
 * La identidad final (logo, paleta, tipografía, fotografía) llega en la fase de acabados:
 * al cambiar estos valores (y tokens.css) cambia toda la app sin tocar los componentes.
 * Son deliberadamente neutros y NO reproducen la paleta de ninguna otra marca.
 */
export const tokens = {
  color: {
    brand: '#2457A6', // azul "leche fresca" provisional
    brandStrong: '#173F7E',
    brandSoft: '#E6EEFA',
    accent: '#E8A33D',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F6F8',
    border: '#E3E5EA',
    text: '#14161A',
    textMuted: '#5E6572',
    success: '#1E8E5A',
    warning: '#B7791F',
    danger: '#C23B3B',
  },
  radius: { card: '16px', control: '12px', pill: '999px' },
  space: { gutter: '16px', section: '24px' },
  font: {
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  /** Ancho máximo de la columna móvil cuando se abre en pantallas grandes. */
  layout: { appMaxWidth: '480px', panelMaxWidth: '1280px' },
} as const;

export type Tokens = typeof tokens;
