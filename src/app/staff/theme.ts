/**
 * Light or dark for the staff app. "auto" follows the phone. The choice is
 * remembered on the device and applied before the page paints (see the
 * inline script in page.tsx), so there is no flash of the wrong theme.
 */
export type Theme = "light" | "dark" | "auto";

export const THEME_KEY = "symmetry-staff-theme";

export const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  auto: "With the phone",
};

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "auto";
}

function isDark(theme: Theme) {
  return (
    theme === "dark" ||
    (theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

/** The browser chrome and the iPhone status bar match the page. */
export function syncThemeColor(theme: Theme = readTheme()) {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark(theme) ? "#161616" : "#ffffff");
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.staffTheme;
  else root.dataset.staffTheme = theme;
  try {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
  syncThemeColor(theme);
}
