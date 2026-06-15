            // Register global shortcuts
            let handle = app.handle().clone();
            
            // CommandOrControl+K
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("CommandOrControl+K", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "command_palette");
                })?;
            }
            
            // Escape
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("Escape", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "escape");
                })?;
            }
            
            // N
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("N", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "new_recipe");
                })?;
            }
            
            // QuestionMark
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("QuestionMark", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "help");
                })?;
            }
            
            // Navigation shortcuts: G + I/R/S/C
            // G+I
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+I", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_ingredients");
                })?;
            }
            
            // G+R
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+R", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_recipes");
                })?;
            }
            
            // G+S
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+S", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_stock");
                })?;
            }
            
            // G+C
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+C", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_costs");
                })?;
            }
            
            // G+B
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+B", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_shopping");
                })?;
            }
            
            // G+U
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+U", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_suggester");
                })?;
            }
            
            // G+P
            {
                let captured_handle = handle.clone();
                let h = handle.clone();
                let h_shortcut = h.global_shortcut();
                h_shortcut.on_shortcut("G+P", move |_app, _shortcut, _event| {
                    let _ = captured_handle.emit("global-shortcut", "nav_settings");
                })?;
            }

            Ok(())