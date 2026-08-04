export const THEMES = [
  { id: "terminal", name: "Phosphor terminal", swatch: "linear-gradient(135deg,#04060a,#3ffb9c)" },
  { id: "neon", name: "Neon vault", swatch: "linear-gradient(135deg,#08061a,#a78bfa 55%,#22d3ee)" },
  { id: "slate", name: "Cipher slate", swatch: "linear-gradient(135deg,#0b0d10,#ff9d4d)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "sharesecret:theme";
const DEFAULT_THEME: ThemeId = "terminal";

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}
