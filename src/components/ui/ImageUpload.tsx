import { RefreshCw, ImagePlus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isBundledIngredientImage } from "../../utils/ingredientDefaults";

interface ImageUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  aspectRatio?: string;
}

export default function ImageUpload({ value, onChange, aspectRatio = "4/3" }: ImageUploadProps) {
  async function handleClick() {
    try {
      const selected = await open({
        filters: [{ name: "Imagem", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (!selected || typeof selected !== "string") return;

      const dataDir = await appDataDir();
      const destDir = dataDir + "images/";
      await mkdir(destDir, { recursive: true });

      const fileName = Date.now() + "_" + selected.split("/").pop();
      const destPath = destDir + fileName;
      await copyFile(selected, destPath);

      onChange(destPath);
    } catch (e) {
      console.error("Erro ao carregar imagem:", e);
    }
  }

  function getDisplaySrc(path: string) {
    if (isBundledIngredientImage(path)) return path;
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
      style={{ aspectRatio, cursor: "pointer" }}
      onClick={handleClick}
    >
      {hasImage ? (
        <>
          <img src={getDisplaySrc(value!)} alt="" />
          <div
            className="img-upload-overlay"
            style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
          >
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
    </div>
  );
}
