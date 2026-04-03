/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A90E2',
          hover: '#357ABD',
          active: '#2E5C8A',
        },
        background: {
          primary: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#e8e8e8',
          hover: '#f0f0f0',
        },
        text: {
          primary: '#1f2937',
          secondary: '#6b7280',
          tertiary: '#9ca3af',
          disabled: '#cccccc',
        },
        border: {
          DEFAULT: '#e5e7eb',
          focus: '#4A90E2',
        },
        success: '#52c41a',
        warning: '#faad14',
        error: '#f5222d',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', '"Monaco"', '"Cascadia Code"', '"Roboto Mono"', 'Consolas', 'monospace'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}
