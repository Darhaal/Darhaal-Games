import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppToaster from "@/components/AppToaster";
import AchievementToaster from "@/components/AchievementToaster";
import Analytics from "@/components/Analytics";
import ConsentBanner from "@/components/ConsentBanner";
import { Suspense } from "react";
import JsonLd from "@/components/seo/JsonLd";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME, SITE_URL } from "@/constants/app";
import { absoluteUrl, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * English is the default locale and is served from the bare path, so the
 * document language is `en`. The Russian subtree under /ru overrides it with a
 * `lang="ru"` wrapper on its own content (valid HTML: the nearest ancestor
 * `lang` wins). Reading the pathname here instead would require `headers()`,
 * which opts the entire app out of static generation — not worth it for one
 * attribute.
 */
/**
 * Search-engine ownership tokens, rendered as meta tags when present.
 *
 * The alternative is dropping the provider's HTML file into `public/`, which
 * is served from the domain root — that works too, but needs a commit and a
 * deploy. Setting the env var in Vercel does not. Yandex is kept for the day
 * the Russian pages are indexed (`INDEXED_LOCALES` in lib/seo.ts).
 */
const verification = {
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  }),
  ...(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION && {
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
  }),
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — board and logic games online with friends`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE.en,
  applicationName: APP_NAME,
  authors: [{ name: COMPANY_NAME }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  // The fallback for app screens, which are noindex anyway. Public pages set
  // their own (buildAlternates).
  alternates: { canonical: absoluteUrl("/") },
  keywords: [
    "online games with friends",
    "browser party games",
    "board games online",
    "spyfall online",
    "coup online",
    "minesweeper multiplayer",
    "battleship online",
    "flag quiz",
    "guess the year photo",
  ],
  category: "games",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/logo512.png", sizes: "512x512" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — board and logic games online with friends`,
    description: APP_TAGLINE.en,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["ru_RU"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — play with friends online`,
    description: APP_TAGLINE.en,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: Object.keys(verification).length > 0 ? verification : undefined,
};

export const viewport: Viewport = {
  themeColor: "#9e1316",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F0F2F5] text-[#334155]`}
      >
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        {children}
        <AppToaster />
        <AchievementToaster />
        {/* Both read the URL, which opts their subtree out of static
            rendering — a Suspense boundary keeps that from spreading to the
            page itself. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <Suspense fallback={null}>
          <ConsentBanner />
        </Suspense>
      </body>
    </html>
  );
}
