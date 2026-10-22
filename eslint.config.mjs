import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const config = [
  { ignores: [".next/**", ".next-mocks/**", "public/mockServiceWorker.js"] },
  ...nextCoreWebVitals,
  {
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];

export default config;
