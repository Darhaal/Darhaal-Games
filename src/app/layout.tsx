import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppToaster from "@/components/AppToaster";
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
 * Russian is the canonical locale and is served from the bare path, so the
 * document language is `ru`. The English subtree under /en overrides it with a
 * `lang="en"` wrapper on its own content (valid HTML: the nearest ancestor
 * `lang` wins). Reading the pathname here instead would require `headers()`,
 * which opts the entire app out of static generation — not worth it for one
 * attribute when hreflang already carries the locale signal.
 */
/**
 * Search-engine ownership tokens, rendered as meta tags when present.
 *
 * The alternative is dropping the provider's HTML file into `public/`, which
 * is served from the domain root — that works too, but needs a commit and a
 * deploy. Setting the env var in Vercel does not. Yandex is here alongside
 * Google because the primary audience is Russian-speaking.
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
    default: `${APP_NAME} — настольные и логические игры онлайн с друзьями`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE.ru,
  applicationName: APP_NAME,
  authors: [{ name: COMPANY_NAME }],
  creator: COMPANY_NAME,
  publisher: COMPANY_NAME,
  // The app entry has a single URL — it switches language client-side, so it
  // declares a canonical only. Real hreflang pairs live on the /games tree.
  alternates: { canonical: absoluteUrl("/") },
  keywords: [
    "игры онлайн",
    "играть с друзьями",
    "настольные игры онлайн",
    "шпион онлайн",
    "сапёр онлайн",
    "морской бой онлайн",
    "переворот coup",
    "викторина флаги",
    "online games with friends",
    "browser party games",
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
    title: `${APP_NAME} — настольные и логические игры онлайн с друзьями`,
    description: APP_TAGLINE.ru,
    url: SITE_URL,
    locale: "ru_RU",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — играйте с друзьями онлайн`,
    description: APP_TAGLINE.ru,
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
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F0F2F5] text-[#334155]`}
      >
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd("ru")} />
        {children}
        <AppToaster />
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
