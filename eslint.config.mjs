import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // next.config.mjs sets images.unoptimized: true, so <img> is the
      // deliberate choice site-wide rather than an oversight to flag.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
