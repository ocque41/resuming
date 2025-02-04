const {heroui} = require('@heroui/theme');
import franken from "franken-ui/shadcn-ui/preset-quick";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  presets: [
    franken({
      customPalette: {
        ".uk-theme-default": {
          "--background": "0 0% 0%",
          "--foreground": "222.2 47.4% 11.2%",
          "--muted": "210 40% 96.1%",
          "--muted-foreground": "215.4 16.3% 46.9%",
          "--card": "0 0% 100%",
          "--card-foreground": "222.2 47.4% 11.2%",
          "--popover": "0 0% 100%",
          "--popover-foreground": "222.2 47.4% 11.2%",
          "--border": "214.3 31.8% 91.4%",
          "--input": "214.3 31.8% 91.4%",
          "--primary": "222.2 47.4% 11.2%",
          "--primary-foreground": "210 40% 98%",
          "--secondary": "210 40% 96.1%",
          "--secondary-foreground": "222.2 47.4% 11.2%",
          "--accent": "210 40% 96.1%",
          "--accent-foreground": "222.2 47.4% 11.2%",
          "--destructive": "0 100% 50%",
          "--destructive-foreground": "210 40% 98%",
          "--ring": "215 20.2% 65.1%",
          "--chart-1": "12 76% 61%",
          "--chart-2": "173 58% 39%",
          "--chart-3": "197 37% 24%",
          "--chart-4": "43 74% 66%",
          "--chart-5": "27 87% 67%",
          "--sidebar-background": "0 0% 98%",
          "--sidebar-foreground": "240 5.3% 26.1%",
          "--sidebar-primary": "240 5.9% 10%",
          "--sidebar-primary-foreground": "0 0% 98%",
          "--sidebar-accent": "240 4.8% 95.9%",
          "--sidebar-accent-foreground": "240 5.9% 10%",
          "--sidebar-border": "220 13% 91%",
          "--sidebar-ring": "217.2 91.2% 59.8%"
        },
        ".dark.uk-theme-default": {
          "--background": "0 0% 0%",
          "--foreground": "213 31% 91%",
          "--muted": "223 47% 11%",
          "--muted-foreground": "215.4 16.3% 56.9%",
          "--card": "224 71% 4%",
          "--card-foreground": "213 31% 91%",
          "--popover": "224 71% 4%",
          "--popover-foreground": "215 20.2% 65.1%",
          "--border": "216 34% 17%",
          "--input": "216 34% 17%",
          "--primary": "210 40% 98%",
          "--primary-foreground": "222.2 47.4% 1.2%",
          "--secondary": "222.2 47.4% 11.2%",
          "--secondary-foreground": "210 40% 98%",
          "--accent": "216 34% 17%",
          "--accent-foreground": "210 40% 98%",
          "--destructive": "0 63% 31%",
          "--destructive-foreground": "210 40% 98%",
          "--ring": "216 34% 17%",
          "--chart-1": "220 70% 50%",
          "--chart-2": "160 60% 45%",
          "--chart-3": "30 80% 55%",
          "--chart-4": "280 65% 60%",
          "--chart-5": "340 75% 55%",
          "--sidebar-background": "240 5.9% 10%",
          "--sidebar-foreground": "240 4.8% 95.9%",
          "--sidebar-primary": "224.3 76.3% 48%",
          "--sidebar-primary-foreground": "0 0% 100%",
          "--sidebar-accent": "240 3.7% 15.9%",
          "--sidebar-accent-foreground": "240 4.8% 95.9%",
          "--sidebar-border": "240 3.7% 15.9%",
          "--sidebar-ring": "217.2 91.2% 59.8%"
        }
      }
    })
  ],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  plugins: [require('tailwindcss-animate'),heroui()],
}
