import { convertFileSrc } from "@tauri-apps/api/core";
import { isBundledIngredientImage } from "../../utils/ingredientDefaults";
import ImagePlaceholder from "./ImagePlaceholder";

interface IngImgProps {
  path: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fit?: "contain" | "cover";
}

export default function IngImg({ path, alt = "", className, style, fit = "contain" }: IngImgProps) {
  if (!path) {
    return <ImagePlaceholder seed={alt} className={className} style={style} />;
  }
  let src = path;
  if (
    !isBundledIngredientImage(path) &&
    !path.startsWith("data:") &&
    !path.startsWith("blob:") &&
    !path.startsWith("http")
  ) {
    try { src = convertFileSrc(path); } catch { src = path; }
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        objectFit: fit,
        objectPosition: "center",
        ...style,
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
