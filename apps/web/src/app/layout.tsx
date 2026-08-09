import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jobhub.islumi.com"),
  applicationName: "jobhub",
  title: { default: "jobhub｜在社交网络里找工作", template: "%s｜jobhub" },
  description: "在小红书和 X 上发现互联网工作机会，按岗位、地点和关键词快速筛选。",
  keywords: ["互联网招聘", "远程工作", "小红书招聘", "X 招聘", "前端招聘", "后端招聘", "产品经理招聘"],
  authors: [{ name: "jobhub", url: "https://jobhub.islumi.com" }],
  creator: "jobhub",
  publisher: "jobhub",
  alternates: { canonical: "/" },
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
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "jobhub",
    title: "jobhub｜在社交网络里找工作",
    description: "在小红书和 X 上发现互联网工作机会。",
    url: "/",
    images: [{ url: "/brand/jobhub-logo.png", width: 512, height: 512, alt: "jobhub" }],
  },
  twitter: {
    card: "summary",
    title: "jobhub｜在社交网络里找工作",
    description: "在小红书和 X 上发现互联网工作机会。",
    images: ["/brand/jobhub-logo.png"],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#31d276", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
