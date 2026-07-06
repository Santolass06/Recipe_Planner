import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";
import type { Image } from "../../crates/core/bindings/Image";
import type { ImageUploadInput } from "../../crates/core/bindings/ImageUploadInput";
import type { ImageEntityType as EntityType } from "../../crates/core/bindings/ImageEntityType";

interface ImageUploadProps {
  entityType: EntityType;
  entityId: number;
  onImageChange?: (image: Image | null) => void;
  maxSizeMB?: number;
  accept?: string;
  showPreview?: boolean;
}

export default function ImageUpload({
  entityType,
  entityId,
  onImageChange,
  maxSizeMB = 5,
  accept = "image/*",
  showPreview = true,
}: ImageUploadProps) {
  const { t } = useI18n();
  const [image, setImage] = useState<Image | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (entityId > 0) {
      loadImage();
    }
  }, [entityId, entityType]);

  const loadImage = async () => {
    try {
      const images = await invoke<Image[]>("image_get", {
        entityType: entityType,
        entityId: entityId,
      });
      const primary = images.find(img => img.is_primary) ?? images[0] ?? null;
      setImage(primary);
      onImageChange?.(primary);
    } catch (e) {
      console.error("Error loading image:", e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      showToast(t("imageUpload.fileTooLarge", { maxSize: maxSizeMB }), "warn");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      if (!base64) return;

      setUploading(true);
      try {
        const uploaded = await invoke<Image>("image_upload", {
          input: {
            entity_type: entityType,
            entity_id: entityId,
            base64,
            mime_type: file.type,
          },
        } as { input: ImageUploadInput });
        setImage(uploaded);
        onImageChange?.(uploaded);
        showToast(t("imageUpload.uploaded"), "ok");
      } catch (e) {
        showToast(t("imageUpload.uploadError"), "err");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!image) return;
    try {
      await invoke("image_delete", { id: image.id });
      setImage(null);
      onImageChange?.(null);
      showToast(t("imageUpload.removed"), "ok");
    } catch (e) {
      showToast(t("imageUpload.removeError"), "err");
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  if (entityId === 0) {
    return (
      <div className="image-upload-placeholder" style={{ opacity: 0.5 }}>
        <p className="text-3 text-muted">{t("imageUpload.saveFirst")}</p>
      </div>
    );
  }

  const imageUrl = image ? `http://localhost:8080/${image.path}` : null;

  return (
    <div className="image-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        disabled={uploading}
      />

      {showPreview && imageUrl && (
        <div className="image-preview" style={{ position: "relative", display: "inline-block" }}>
          <img
            src={imageUrl}
            alt={t("imageUpload.preview")}
            style={{
              maxWidth: "200px",
              maxHeight: "200px",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--color-border)",
            }}
          />
          <button
            type="button"
            className="btn-icon danger"
            onClick={handleDelete}
            title={t("imageUpload.removeImage")}
            aria-label={t("imageUpload.removeImage")}
            style={{
              position: "absolute",
              top: "-8px",
              right: "-8px",
              zIndex: 10,
              background: "var(--color-danger)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {!imageUrl && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={triggerFileSelect}
          disabled={uploading}
          style={{ width: "100%", maxWidth: "200px" }}
        >
          {uploading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/>
              </svg>
              {t("imageUpload.uploading")}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {t("imageUpload.addImage")}
            </>
          )}
        </button>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="alert" aria-live="polite" style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {toast.type === "ok" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
          {toast.type === "err" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {toast.type === "warn" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          <span className="text-3">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}