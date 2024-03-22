module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/prefer-readonly": "error",
  },
  ignorePatterns: ["/*", "!/packs/BP/scripts"],
};
