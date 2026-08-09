import type { Platform } from "../lib/jobs";

export function PlatformIcon({ platform, size = 18 }: { platform: Platform; size?: number }) {
  const isXhs = platform === "XHS";
  return (
    <span className={`platform-icon platform-icon-${platform.toLowerCase()}`} style={{ height: size, width: size }}>
      <img
        alt=""
        aria-hidden="true"
        height={size}
        src={isXhs ? "/brands/xiaohongshu.ico" : "/brands/x.svg"}
        width={size}
      />
    </span>
  );
}
