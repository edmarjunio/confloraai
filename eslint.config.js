module.exports = [
  { ignores: ["src/dataconnect-admin-generated/**", "functions/lib/**"] },
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        console: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setImmediate: "readonly",
        performance: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
        structuredClone: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
    },
  },
  {
    files: ["src/components/index.js"],
    languageOptions: { sourceType: "module" },
  },
  {
    files: ["public/storefront/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { document: "readonly", window: "readonly", navigator: "readonly", location: "readonly", history: "readonly", localStorage: "readonly", crypto: "readonly", TextEncoder: "readonly", AbortController: "readonly" },
    },
  },
];
