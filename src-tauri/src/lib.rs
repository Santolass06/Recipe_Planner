use mise_entitlements::{is_allowed, AccountType, Feature};

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
fn feature_allowed(account: AccountType, feature: Feature) -> bool {
    is_allowed(account, feature)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ping, feature_allowed])
        .run(tauri::generate_context!())
        .expect("erro ao arrancar a aplicação Tauri");
}
