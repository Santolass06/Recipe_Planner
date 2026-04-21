import { useRef } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ImageUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  aspectRatio?: string;
}

export default function ImageUpload({ value, onChange, aspectRatio = "4/3" }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = (file as unknown as { path?: string }).path ?? file.name;
    onChange(path);
    e.target.value = "";
  }

  function getDisplaySrc(path: string) {
    if (path.startsWith("data:") || path.startsWith("blob:")) return path;
    try {
      return convertFileSrc(path);
    } catch {
      return path;
    }
  }

  const hasImage = !!value;

  return (
    <div
      className={`img-upload-zone ${hasImage ? "has-image" : ""}`}
      style={{ aspectRatio }}
      onClick={() => inputRef.current?.click()}
    >
      {hasImage ? (
        <>
          <img src={getDisplaySrc(value!)} alt="" />
          <div className="img-upload-overlay" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <RefreshCw size={18} />
            <span>Alterar imagem</span>
          </div>
        </>
      ) : (
        <>
          <ImagePlus size={22} style={{ color: "var(--text-light)" }} />
          <span className="img-upload-hint">Clique para adicionar imagem</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}
