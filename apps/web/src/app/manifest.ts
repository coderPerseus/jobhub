import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "jobhub｜在社交网络里找工作",
    short_name: "jobhub",
    description: "在小红书和 X 上发现互联网工作机会。",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f2",
    theme_color: "#31d276",
    icons: [{ src: "/brand/jobhub-logo.png", sizes: "512x512", type: "image/png" }],
  };
}
