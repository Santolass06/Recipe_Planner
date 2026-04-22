import type { CSSProperties } from "react";

interface ImagePlaceholderProps {
  seed: string;
  className?: string;
  style?: CSSProperties;
}

const STRIPES = [
  "stripe-amber", "stripe-rose", "stripe-sage", "stripe-sand",
  "stripe-cocoa", "stripe-stone", "stripe-butter", "stripe-terra",
];

function stripeFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return STRIPES[Math.abs(h) % STRIPES.length];
}

export default function ImagePlaceholder({ seed, className, style }: ImagePlaceholderProps) {
  return (
    <div
      className={`${stripeFor(seed)} ${className ?? ""}`}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
