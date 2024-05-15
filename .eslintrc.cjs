module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./scripts/tsconfig.json"],
  },
  overrides: [
    {
      files: ["*.ts"],
      extends: [
        "plugin:@typescript-eslint/strict-type-checked",
        "plugin:@typescript-eslint/stylistic-type-checked",
      ],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
      },
    },
    {
      files: ["*.cjs"],
      env: {
        node: true,
      },
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
};
