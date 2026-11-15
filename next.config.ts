import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,  // English moved from /en to the bare path on 2026-10-05; Google had already
  // indexed the /en game pages, so they redirect permanently rather than 404.
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
    ];
  },
  // The document language for crawlers that read the header rather than run
  // the script that sets <html lang> (Bing, Yandex). See src/app/layout.tsx.
  async headers() {
    return ["ru", "uk"].flatMap((lang) =>
      [`/${lang}`, `/${lang}/:path*`].map((source) => ({
        source,
        headers: [{ key: "Content-Language", value: lang }],
      })),
    );
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },      // country flags (Flager)
      { protocol: "https", hostname: "**.supabase.co" },   // uploaded avatars (storage)
    ],
    // Avatars are now rendered by our own /avatar/[seed] route, so no external
    // host is needed for them. SVG stays enabled for that route, behind a strict CSP.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
