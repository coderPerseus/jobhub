import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "jobhub｜社交网络工作机会",
    short_name: "jobhub",
    description: "聚合并结构化展示小红书与 X 上的互联网招聘信息。",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f2",
    theme_color: "#31d276",
    icons: [{ src: "/brand/jobhub-logo.png", sizes: "512x512", type: "image/png" }],
  };
}
