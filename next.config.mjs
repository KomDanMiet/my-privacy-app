// next.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Zorg dat '@' altijd naar de projectroot wijst (ongeacht ts/jsconfig)
    const __dirname = dirname(fileURLToPath(import.meta.url));
    config.resolve.alias["/"] ||= __dirname;   // optioneel
    config.resolve.alias["@"] = __dirname;     // <-- belangrijk
    return config;
  },
};

export default nextConfig;
