import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a wasm binary that must not be bundled into the server build.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
