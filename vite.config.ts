import react from "@vitejs/plugin-react-oxc";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    plugins: ["typescript", "react", "jsx-a11y", "import", "vitest", "unicorn", "oxc"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "jsx-a11y/media-has-caption": "off",
      "react/button-has-type": "error",
      "react/exhaustive-deps": "error",
      "react/hook-use-state": "error",
      "react/jsx-key": "error",
      "react/jsx-max-depth": ["error", { max: 7 }],
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-array-index-key": "error",
      "react/no-children-prop": "error",
      "react/no-danger": "error",
      "react/no-multi-comp": "off",
      "react/no-unstable-nested-components": "error",
      "react/only-export-components": "error",
      "react/rules-of-hooks": "error",
      "react/self-closing-comp": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 8787,
  },
});
