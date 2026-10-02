import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": false }]
    }
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off"
    }
  },
  { ignores: ["dist/**", "coverage/**", "drizzle/**"] }
);
