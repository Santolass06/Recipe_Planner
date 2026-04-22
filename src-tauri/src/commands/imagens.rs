use std::{
    fs,
    io::BufReader,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use image::{codecs::webp::WebPEncoder, ImageEncoder, ImageFormat, ImageReader};
use tauri::{AppHandle, Manager};

const ALLOWED_EXTENSIONS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];

#[tauri::command]
pub async fn importar_imagem(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(source_path);
    let ext = extension(&source).ok_or_else(|| "Ficheiro sem extensão".to_string())?;

    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err("Formato de imagem não suportado".to_string());
    }

    let dest_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");

    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

        if ext == "png" {
            convert_png_to_webp(&source, &dest_dir)
        } else {
            copy_original(&source, &dest_dir, &ext)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn convert_png_to_webp(source: &Path, dest_dir: &Path) -> Result<String, String> {
    let file = fs::File::open(source).map_err(|e| e.to_string())?;
    let img = ImageReader::with_format(BufReader::new(file), ImageFormat::Png)
        .decode()
        .map_err(|e| e.to_string())?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let dest_path = unique_dest_path(source, dest_dir, "webp");
    let file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;

    WebPEncoder::new_lossless(file)
        .write_image(&rgba, width, height, image::ColorType::Rgba8.into())
        .map_err(|e| e.to_string())?;

    Ok(dest_path.to_string_lossy().into_owned())
}

fn copy_original(source: &Path, dest_dir: &Path, ext: &str) -> Result<String, String> {
    let dest_path = unique_dest_path(source, dest_dir, ext);
    fs::copy(source, &dest_path).map_err(|e| e.to_string())?;
    Ok(dest_path.to_string_lossy().into_owned())
}

fn unique_dest_path(source: &Path, dest_dir: &Path, ext: &str) -> PathBuf {
    let stem = source
        .file_stem()
        .and_then(|name| name.to_str())
        .map(sanitize_file_stem)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "imagem".to_string());

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    dest_dir.join(format!("{timestamp}_{stem}.{ext}"))
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
}

fn sanitize_file_stem(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}
