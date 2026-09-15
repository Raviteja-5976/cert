import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Keep the PDF renderer out of the webpack bundle; fontkit resolves its own assets.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF renderer reads brand fonts and partner artwork from disk at request time,
  // so those files must be traced into the serverless bundle.
  //
  // pdfkit's standard fonts need the same treatment for a different reason: it loads them
  // through the wildcard subpath import "#standard-fonts/*", which the file tracer cannot
  // resolve statically, so none of them are traced. Every PDFDocument initialises with
  // Helvetica regardless of the fonts we register, so without these the renderer throws
  // "Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs" in the Lambda.
  outputFileTracingIncludes: {
    "/api/certificate/**": [
      "./assets/fonts/**",
      "./assets/pdf/**",
      "./node_modules/pdfkit/js/standard-fonts/**",
    ],
  },
};

export default nextConfig;
