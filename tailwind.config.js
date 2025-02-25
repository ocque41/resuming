const { heroui } = require('@heroui/theme');
import franken from "franken-ui/shadcn-ui/preset-quick";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  presets: [
    franken({
      // You can override the preset palette if needed.
      customPalette: {
        ".uk-theme-default": {
          "--background": "#050505",
          "--foreground": "#ffffff",
          "--primary": "#E8DCC4",
          "--border": "#E8DCC4",
        },
      },
    })
  ],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  plugins: [require('tailwindcss-animate'), heroui()],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        foreground: "#ffffff",
        accent: "#E8DCC4",
        primary: "#E8DCC4",
        border: "#E8DCC4"
      },
      // You may remove any additional variables you no longer need.
    },
  },
};
