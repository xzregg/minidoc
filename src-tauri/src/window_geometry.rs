#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn fit_window(window: Bounds, work_area: Bounds) -> Bounds {
    let width = window.width.min(work_area.width).max(1);
    let height = window.height.min(work_area.height).max(1);
    Bounds {
        x: (window.x as i64).clamp(work_area.x as i64, work_area.x as i64 + (work_area.width - width) as i64) as i32,
        y: (window.y as i64).clamp(work_area.y as i64, work_area.y as i64 + (work_area.height - height) as i64) as i32,
        width,
        height,
    }
}

pub fn should_save(closing: bool, losing_focus: bool) -> bool {
    closing || losing_focus
}

pub fn valid_saved_size(width: u64, height: u64) -> bool {
    width > 0 && height > 0 && width <= u32::MAX as u64 && height <= u32::MAX as u64
}

pub fn inner_limit(work_area: (u32, u32), frame: (u32, u32)) -> (u32, u32) {
    (work_area.0.saturating_sub(frame.0).max(1), work_area.1.saturating_sub(frame.1).max(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oversized_restored_window_fits_screen_work_area() {
        let saved = Bounds { x: 1500, y: -400, width: 2400, height: 1800 };
        let work_area = Bounds { x: 0, y: 25, width: 1440, height: 835 };
        assert_eq!(fit_window(saved, work_area), Bounds { x: 0, y: 25, width: 1440, height: 835 });
    }

    #[test]
    fn closing_window_saves_without_waiting_for_process_exit() {
        assert!(should_save(true, false));
    }

    #[test]
    fn zero_sized_history_uses_startup_defaults() {
        assert!(!valid_saved_size(0, 720));
        assert!(!valid_saved_size(1000, 0));
        assert!(!valid_saved_size(u64::MAX, 720));
        assert!(valid_saved_size(1000, 720));
    }

    #[test]
    fn native_frame_is_reserved_inside_work_area() {
        assert_eq!(inner_limit((1440, 835), (16, 38)), (1424, 797));
    }

    #[test]
    fn normal_window_keeps_its_previous_size_and_position() {
        let window = Bounds { x: 80, y: 70, width: 1000, height: 720 };
        let area = Bounds { x: 0, y: 25, width: 1440, height: 835 };
        assert_eq!(fit_window(window, area), window);
    }

    #[test]
    fn negative_coordinate_monitor_keeps_window_reachable() {
        let window = Bounds { x: -2400, y: -80, width: 1000, height: 720 };
        let area = Bounds { x: -1920, y: 25, width: 1920, height: 1055 };
        assert_eq!(fit_window(window, area), Bounds { x: -1920, y: 25, width: 1000, height: 720 });
    }

    #[test]
    fn small_monitor_limits_default_window_and_second_pass_is_stable() {
        let window = Bounds { x: 100, y: 100, width: 1000, height: 720 };
        let area = Bounds { x: 0, y: 25, width: 800, height: 575 };
        let fitted = fit_window(window, area);
        assert_eq!(fitted, Bounds { x: 0, y: 25, width: 800, height: 575 });
        assert_eq!(fit_window(fitted, area), fitted);
    }

    #[test]
    fn losing_focus_saves_but_drag_events_do_not_write_to_disk() {
        assert!(should_save(false, true));
        assert!(!should_save(false, false));
    }
}
