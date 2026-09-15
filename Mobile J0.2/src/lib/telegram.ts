// Thin wrapper around the real Telegram WebApp SDK (loaded globally in
// index.html via https://telegram.org/js/telegram-web-app.js). Falls back to
// safe no-ops so the app still runs in a plain dev browser.

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
}

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramHapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TelegramWebAppUser };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  viewportHeight?: number;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  BackButton: TelegramBackButton;
  HapticFeedback?: TelegramHapticFeedback;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | null {
  return typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;
}

export const isTelegram = (): boolean => webApp() !== null;

export function initTelegram(): void {
  const app = webApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.disableVerticalSwipes?.();
  app.setHeaderColor?.("#f3f2f2");
  app.setBackgroundColor?.("#eae9e9");
}

export function getInitData(): string {
  return webApp()?.initData ?? "";
}

export function getTelegramUser(): TelegramWebAppUser | undefined {
  return webApp()?.initDataUnsafe?.user;
}

export function setBackButton(visible: boolean, onClick: () => void): () => void {
  const app = webApp();
  if (!app?.BackButton) return () => {};
  if (visible) {
    app.BackButton.show();
    app.BackButton.onClick(onClick);
  } else {
    app.BackButton.hide();
  }
  return () => {
    app.BackButton.offClick(onClick);
  };
}

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection" = "light"): void {
  const feedback = webApp()?.HapticFeedback;
  if (!feedback) return;
  if (kind === "success" || kind === "warning" || kind === "error") feedback.notificationOccurred(kind);
  else if (kind === "selection") feedback.selectionChanged();
  else feedback.impactOccurred(kind);
}
