use gitpulse_document_svg::*;
use std::ffi::CString;
use std::ptr;
fn main() {
    let r = unsafe { gt_document_svg_renderer_new() };
    let font = std::fs::read("C:/Windows/Fonts/verdana.ttf").unwrap();
    unsafe { gt_document_svg_renderer_add_font(r, font.as_ptr(), font.len()) };
    for name in ["text-unscaled.svg", "text-transform.svg"] {
        for len in ["", " textLength=\"780\""] {
            let mut src = std::fs::read_to_string(format!("tests/fixtures/{name}")).unwrap();
            if name == "text-transform.svg" && !len.is_empty() { src = src.replace(" textLength=\"390\"", len); }
            let mut image = RenderedImage { width: 0, height: 0, pixels: ptr::null_mut() };
            let c = CString::new("#ffffff").unwrap();
            let status = unsafe { gt_document_svg_render(r, src.as_ptr(), src.len(), 476.0, 80.0, c.as_ptr(), &mut image) };
            let data = unsafe { std::slice::from_raw_parts(image.pixels, image.width as usize * image.height as usize * 4) };
            let mut left = None; let mut right = 0u32; let mut count = 0;
            for (i, p) in data.chunks_exact(4).enumerate() { if p[0] > 200 && p[3] > 0 { let x = (i as u32) % image.width; left.get_or_insert(x); right = right.max(x); count += 1; } }
            println!("{name}{len}: status={status:?} {}x{} white={count} span={left:?}..{right}", image.width, image.height);
            unsafe { gt_document_svg_pixels_free(image) };
        }
    }
}
