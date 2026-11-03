
import PresenceTracker from "./components/PresenceTracker";
import MaintenanceGuard from "./components/MaintenanceGuard";

// ======================================================
// OJT MINETRACK V2.0
// ROOT LAYOUT — GLOBAL LIGHT / DARK THEME
// ======================================================

export const metadata = {
  title: "OJT MineTrack v2.0",
  description:
    "Monitoring dan Evaluasi OJT - Emergency Response Group PT Berau Coal",
};

// ======================================================
// INITIAL THEME
//
// - Default: Light Mode
// - Pilihan disimpan di localStorage
// - Tema diterapkan sebelum halaman tampil
// - Berlaku untuk semua halaman Next.js
// ======================================================

const themeScript = `
(function () {
  try {
    var savedTheme = localStorage.getItem("ojt-minetrack-theme");

    var theme =
      savedTheme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.setAttribute(
      "data-theme",
      "light"
    );

    document.documentElement.style.colorScheme = "light";
  }

  window.addEventListener("storage", function (event) {
    if (event.key === "ojt-minetrack-theme") {
      var theme =
        event.newValue === "dark" ? "dark" : "light";

      document.documentElement.setAttribute(
        "data-theme",
        theme
      );

      document.documentElement.style.colorScheme = theme;
    }
  });
})();
`;

// ======================================================
// GLOBAL THEME VARIABLES
// ======================================================

const globalThemeCSS = `
  :root,
  :root[data-theme="light"] {
    color-scheme: light;

    --mt-page-bg: #f3f6fa;
    --mt-surface: #ffffff;
    --mt-surface-secondary: #f5f9fb;

    --mt-text: #14283a;
    --mt-text-muted: #718293;

    --mt-border: #dce7eb;

    --mt-primary: #008b58;
    --mt-primary-hover: #007448;

    --mt-sidebar-bg: #003e35;
    --mt-header-bg: #003e35;

    --mt-input-bg: #ffffff;
    --mt-card-shadow: rgba(20, 59, 58, 0.06);
  }

  :root[data-theme="dark"] {
    color-scheme: dark;

    --mt-page-bg: #0d171b;
    --mt-surface: #17272b;
    --mt-surface-secondary: #203438;

    --mt-text: #edf8f4;
    --mt-text-muted: #a5bbb8;

    --mt-border: #30484b;

    --mt-primary: #28c88b;
    --mt-primary-hover: #39dfa0;

    --mt-sidebar-bg: #081f1d;
    --mt-header-bg: #092b27;

    --mt-input-bg: #1a3033;
    --mt-card-shadow: rgba(0, 0, 0, 0.18);
  }

  html {
    min-height: 100%;
    background: var(--mt-page-bg);
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: Arial, sans-serif;

    background: var(--mt-page-bg);
    color: var(--mt-text);

    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  * {
    box-sizing: border-box;
  }
`;

// ======================================================
// ROOT LAYOUT
// ======================================================

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: globalThemeCSS,
          }}
        />
      </head>

      <body>
        <MaintenanceGuard>
          <PresenceTracker />
          {children}
        </MaintenanceGuard>
      </body>
    </html>
  );
}
