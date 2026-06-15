import { heroui } from "@heroui/theme";

// FuturePayCA brand theme for HeroUI
export default heroui({
  themes: {
    light: {
      colors: {
        primary: { DEFAULT: "#005df5", foreground: "#ffffff" },
        success: { DEFAULT: "#16a34a", foreground: "#ffffff" },
        warning: { DEFAULT: "#c2710c", foreground: "#ffffff" },
        danger: { DEFAULT: "#dc2626", foreground: "#ffffff" },
        focus: "#005df5",
      },
    },
    // dark: HeroUI's native dark theme (soft translucent dividers, no hard lines).
    // Only the brand accents are overridden; surfaces/dividers/default scale use defaults.
    dark: {
      colors: {
        primary: { DEFAULT: "#5b9bff", foreground: "#0b1220" },
        success: { DEFAULT: "#4ade80", foreground: "#08130c" },
        warning: { DEFAULT: "#fbbf24", foreground: "#1a1304" },
        danger: { DEFAULT: "#f87171", foreground: "#1a0808" },
        focus: "#5b9bff",
      },
    },
  },
  layout: { radius: { small: "8px", medium: "10px", large: "14px" } },
});