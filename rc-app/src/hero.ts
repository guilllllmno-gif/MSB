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
  },
  layout: { radius: { small: "8px", medium: "10px", large: "14px" } },
});
