import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    ".claude/**",
    "**/.claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // next-pwa / Workbox generated bundles (production build artifacts)
    "public/sw.js",
    "public/sw *.js",
    "public/workbox-*.js",
    // Capacitor native build artifacts
    "android/**",
    "ios/**",
    // next-pwa worker bundles
    "public/worker-*.js",
    // Design handoff references (not app code)
    "design/**",
    // design-sync artifacts: the generated design-system bundle, the emitted
    // declaration tree, and the staged converter scripts. All regenerated, never
    // hand-edited, and all gitignored.
    "ds-bundle/**",
    "ds-types/**",
    ".ds-sync/**",
    ".design-sync/**",
  ]),
]);

export default eslintConfig;
