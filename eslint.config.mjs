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
    ".cloudflare/**",
    ".vinext/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    files: ["src/**/*.tsx"],
    // Native form elements belong inside the shared controls. Tests can use
    // native fixtures to exercise browser form semantics.
    ignores: ["src/components/ui/**", "src/tests/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(input|select|textarea)$/]",
          message: "Use the shared Input, Select, Textarea or Checkbox component from @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='Input'] JSXAttribute[name.name='type'] Literal[value=/^(date|datetime-local|time|month|checkbox)$/]",
          message: "Use DatePicker (including month/time modes) or Checkbox instead of a native picker through Input.",
        },
      ],
    },
  },
]);

export default eslintConfig;
