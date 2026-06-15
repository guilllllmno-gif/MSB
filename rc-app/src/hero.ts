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
    dark: {
      colors: {
        background: "#0c0e13",
        foreground: "#e7eaf0",
        content1: "#161a21",
        content2: "#1d222b",
        content3: "#272d38",
        divider: "#272d38",
        primary: { DEFAULT: "#5b9bff", foreground: "#0b1220" },
        success: { DEFAULT: "#4ade80", foreground: "#08130c" },
        warning: { DEFAULT: "#fbbf24", foreground: "#1a1304" },
        danger: { DEFAULT: "#f87171", foreground: "#1a0808" },
        focus: "#5b9bff",
        default: {
          100: "#1d222b", 200: "#272d38", 300: "#39414f",
          400: "#7b8494", 500: "#9aa3b2", 600: "#b9c0cc", 700: "#d6dae1",
          foreground: "#e7eaf0",
        },
      },
    },
  },
  layout: { radius: { small: "8px", medium: "10px", large: "14px" } },
});