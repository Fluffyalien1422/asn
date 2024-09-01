// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    extends: [eslint.configs.recommended],
    ignores: ["build/**/*"],
  },
  {
    files: ["**/*.ts"],
    extends: tseslint.configs.strictTypeChecked,
    languageOptions: {
      parserOptions: {
        project: true,
        // @ts-expect-error no dirname
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
);
