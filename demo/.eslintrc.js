module.exports = {
  extends: [
    "plugin:terreno/recommended"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "react/function-component-definition": "off",
    "import/no-default-export": "off"
  }
};

