use crate::window_geometry::{fit_window, inner_limit, should_save, valid_saved_size, Bounds};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, Window, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

// Visibility belongs to startup, not persisted state: the window starts hidden
// until restored geometry has been checked against the current monitor.
pub fn flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN
}

#[derive(Default)]
pub struct Limits(Mutex<HashMap<String, PhysicalSize<u32>>>);

pub fn restore(window: &Window) {
    let valid = saved_size_is_valid(window);
    let restored = valid
        && match window.restore_state(StateFlags::SIZE | StateFlags::POSITION) {
            Ok(()) => true,
            Err(error) => {
                eprintln!("[minidoc] 恢复窗口状态失败，使用默认大小: {error}");
                false
            }
        };
    if !restored {
        let config = window.app_handle().config().app.windows.iter()
            .find(|config| config.label == window.label());
        let (width, height) = config.map(|config| (config.width, config.height))
            .unwrap_or((1000.0, 720.0));
        if let Err(error) = window.set_size(LogicalSize::new(width, height))
            .and_then(|_| window.center()) {
            eprintln!("[minidoc] 使用默认窗口大小失败: {error}");
        }
    }
    if let Err(error) = constrain(window, true) {
        eprintln!("[minidoc] 限制恢复窗口范围失败: {error}");
    }
    if restored {
        if let Err(error) = window.restore_state(StateFlags::MAXIMIZED | StateFlags::FULLSCREEN) {
            eprintln!("[minidoc] 恢复窗口显示模式失败: {error}");
        }
    }
    if let Err(error) = window.show() {
        eprintln!("[minidoc] 显示窗口失败: {error}");
    }
}

fn saved_size_is_valid(window: &Window) -> bool {
    let app = window.app_handle();
    let saved = app.path().app_config_dir().ok()
        .and_then(|directory| std::fs::read(directory.join(app.filename())).ok())
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
    saved.as_ref().and_then(|state| state.get(window.label()))
        .map(|state| {
            valid_saved_size(
                state["width"].as_u64().unwrap_or(0),
                state["height"].as_u64().unwrap_or(0),
            )
        }).unwrap_or(true)
}

pub fn handle_event(window: &Window, event: &WindowEvent) {
    if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)
        | WindowEvent::ScaleFactorChanged { .. }) {
        if let Err(error) = constrain(window, !matches!(event, WindowEvent::Moved(_))) {
            eprintln!("[minidoc] 限制窗口范围失败: {error}");
        }
    }
    if should_save(
        matches!(event, WindowEvent::CloseRequested { .. }),
        matches!(event, WindowEvent::Focused(false)),
    ) {
        if let Err(error) = window.app_handle().save_window_state(flags()) {
            eprintln!("[minidoc] 保存窗口状态失败: {error}");
        }
    }
}

fn constrain(window: &Window, reposition: bool) -> tauri::Result<()> {
    // Native sizing can synchronously dispatch another window event.
    let state = window.state::<Limits>();
    let Ok(mut limits) = state.0.try_lock() else {
        return Ok(());
    };
    if window.is_minimized()? || window.is_maximized()? || window.is_fullscreen()? {
        return Ok(());
    }
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };
    let work_area = monitor.work_area();
    if work_area.size.width == 0 || work_area.size.height == 0 {
        return Ok(());
    }
    let outer = window.outer_size()?;
    let inner = window.inner_size()?;
    let position = window.outer_position()?;
    let frame_width = outer.width.saturating_sub(inner.width);
    let frame_height = outer.height.saturating_sub(inner.height);
    let (width, height) = inner_limit(
        (work_area.size.width, work_area.size.height),
        (frame_width, frame_height),
    );
    let maximum = PhysicalSize::new(width, height);
    if limits.get(window.label()) != Some(&maximum) {
        window.set_max_size(Some(maximum))?;
        limits.insert(window.label().to_string(), maximum);
    }
    let fitted = fit_window(
        Bounds {
            x: position.x, y: position.y,
            width: outer.width, height: outer.height,
        },
        Bounds {
            x: work_area.position.x, y: work_area.position.y,
            width: work_area.size.width, height: work_area.size.height,
        },
    );
    let size = PhysicalSize::new(
        fitted.width.saturating_sub(frame_width).max(1),
        fitted.height.saturating_sub(frame_height).max(1),
    );
    if size != inner {
        window.set_size(size)?;
    }
    let target_position = PhysicalPosition::new(fitted.x, fitted.y);
    if reposition && target_position != position {
        window.set_position(target_position)?;
    }
    Ok(())
}
