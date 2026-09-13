import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Keep the PDF renderer out of the webpack bundle; fontkit resolves its own assets.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF renderer reads brand fonts and partner artwork from disk at request time,
  // so those files must be traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/api/certificate/**": ["./assets/fonts/**", "./assets/pdf/**"],
  },
};

export default nextConfig;
