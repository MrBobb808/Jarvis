import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We sit inside a parent folder that also has a lockfile; pin the root so
  // Turbopack doesn't infer the wrong workspace.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
