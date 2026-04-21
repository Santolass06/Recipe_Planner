import { convertFileSrc } from "@tauri-apps/api/core";

interface IngImgProps {
  path: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

const STRIPE_CLASSES = [
  "stripe-amber", "stripe-rose", "stripe-sage", "stripe-sand",
  "stripe-cocoa", "stripe-stone", "stripe-butter", "stripe-terra",
];

function stripeFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return STRIPE_CLASSES[Math.abs(h) % STRIPE_CLASSES.length];
}

export default function IngImg({ path, alt = "", className, style }: IngImgProps) {
  if (!path) {
    const stripe = stripeFor(alt);
    return <div className={`${stripe} ${className ?? ""}`} style={style} />;
  }
  let src = path;
  if (!path.startsWith("data:") && !path.startsWith("blob:") && !path.startsWith("http")) {
    try { src = convertFileSrc(path); } catch { src = path; }
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
