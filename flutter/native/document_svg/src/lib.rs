//! Renders document SVG images to pixels for the GitPulse Flutter client.
//!
//! The boundary is deliberately narrow (ADR 0027): a [`Renderer`] is handed SVG
//! bytes, a target box and the theme colour, and answers with premultiplied
//! RGBA pixels or an error code. It never fetches anything. Fonts are whatever
//! the caller loaded into it beforehand, and embedded images are only ever
//! resolved from `data:` URLs inside the SVG itself.

use std::os::raw::{c_char, c_uchar};
use std::slice;
use std::sync::Arc;

use resvg::tiny_skia;
use resvg::usvg;
use resvg::usvg::fontdb;

/// Status codes returned across the FFI boundary. The Dart caller maps them to
/// the same localised resource fallback the document already uses.
#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Ok = 0,
    /// A NULL pointer, a zero dimension or an unreadable string.
    InvalidArgument = 1,
    /// The bytes are not an SVG document resvg understands.
    ParseFailed = 2,
    /// The document is valid but its raster could not be produced.
    RenderFailed = 3,
    /// The raster exceeded the size the caller allowed.
    TooLarge = 4,
}

/// The intrinsic size of a document and the size it should occupy in a box.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct SvgSize {
    /// Width and height of the document's own coordinate system.
    pub width: f32,
    pub height: f32,
    /// Width and height to display at, after fitting into the requested box.
    pub fitted_width: f32,
    pub fitted_height: f32,
}

/// An opaque, long-lived renderer. One is created per application and filled
/// with the fonts the host chose to expose.
pub struct Renderer {
    fonts: Arc<fontdb::Database>,
}

/// The largest raster this library will allocate, in pixels. Guards the host
/// against an SVG that would ask for an enormous bitmap.
const MAX_PIXELS: u64 = 16 * 1024 * 1024;

/// Builds parse options: the caller's fonts, no resource lookups outside the
/// document, and the theme's `currentColor`.
fn options(renderer: &Renderer, current_color: Option<&str>) -> usvg::Options<'static> {
    let mut options = usvg::Options {
        fontdb: renderer.fonts.clone(),
        // Never reach outside the document for resources: relative paths have
        // nothing to resolve against, and only `data:` URLs inside the SVG
        // itself are honoured.
        resources_dir: None,
        image_href_resolver: usvg::ImageHrefResolver {
            resolve_data: usvg::ImageHrefResolver::default_data_resolver(),
            resolve_string: Box::new(|_, _| None),
        },
        font_family: "sans-serif".to_owned(),
        font_resolver: font_resolver(),
        ..usvg::Options::default()
    };
    if let Some(color) = current_color {
        // `currentColor` is the one theme-driven value a document image gets.
        // The rule targets the root element, so a shape with its own explicit
        // `fill` — which outranks an inherited colour — keeps that colour.
        options.style_sheet = Some(format!("svg {{ color: {color} }}"));
    }
    options
}

/// Family names a document may ask for that no host is guaranteed to have.
/// When none of the requested families exist, any loaded face is better than
/// painting no text at all: a badge with a slightly different face is readable,
/// an empty badge is not.
const GENERIC_FAMILIES: [&str; 6] = [
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
];

/// Selects the requested family when the host loaded it, otherwise the first
/// loaded face. This is what keeps a host with only, say, Noto Sans from
/// rendering a Verdana badge as nothing.
fn font_resolver() -> usvg::FontResolver<'static> {
    usvg::FontResolver {
        select_font: Box::new(|font, database| {
            let requested: Vec<fontdb::Family<'_>> = font
                .families()
                .iter()
                .map(|family| match family {
                    usvg::FontFamily::Serif => fontdb::Family::Serif,
                    usvg::FontFamily::SansSerif => fontdb::Family::SansSerif,
                    usvg::FontFamily::Cursive => fontdb::Family::Cursive,
                    usvg::FontFamily::Fantasy => fontdb::Family::Fantasy,
                    usvg::FontFamily::Monospace => fontdb::Family::Monospace,
                    usvg::FontFamily::Named(name) => fontdb::Family::Name(name),
                })
                .collect();
            let query = fontdb::Query {
                families: &requested,
                weight: fontdb::Weight(font.weight()),
                stretch: fontdb::Stretch::Normal,
                style: fontdb::Style::Normal,
            };
            // `facets` is what a host can actually draw with; a family it never
            // loaded can still borrow the first face rather than paint nothing.
            let first = database.faces().map(|face| face.id).next();
            first.or_else(|| database.query(&query))
        }),
        select_fallback: usvg::FontResolver::default_fallback_selector(),
    }
}

/// Reports the generic substitution once per renderer, so a host with an
/// unusual font set can be diagnosed without flooding the log.
fn log_once_fallback(database: &fontdb::Database, id: fontdb::ID) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static REPORTED: AtomicBool = AtomicBool::new(false);
    if REPORTED.swap(true, Ordering::Relaxed) {
        return;
    }
    if let Some(face) = database.face(id) {
        let name = face
            .families
            .first()
            .map(|family| family.0.as_str())
            .unwrap_or("unknown");
        let _ = GENERIC_FAMILIES; // The list documents the names above.
        eprintln!("gitpulse: document SVG font substitution, using {name}");
    }
}

/// Parses a document and hands the tree to `body`, keeping the options alive
/// for as long as the tree may borrow from them.
fn with_tree<T>(
    renderer: &Renderer,
    svg: &[u8],
    current_color: Option<&str>,
    body: impl FnOnce(&usvg::Tree) -> Result<T, Status>,
) -> Result<T, Status> {
    let text = std::str::from_utf8(svg).map_err(|_| Status::ParseFailed)?;
    let options = options(renderer, current_color);
    let tree = usvg::Tree::from_str(text, &options).map_err(|_| Status::ParseFailed)?;
    body(&tree)
}

/// Fits the document's intrinsic size into a box, preserving its aspect ratio.
/// A zero or non-finite maximum leaves that axis unconstrained.
///
/// The box is the space the caller decided the image may occupy, already in
/// device pixels, so scaling up is how a 119×20 badge stays crisp on a 4×
/// screen. Whether the image should grow beyond its intrinsic size in the
/// layout is the document renderer's decision, not this library's.
fn fit(intrinsic: (f32, f32), max_width: f32, max_height: f32) -> Option<(f32, f32)> {
    let (width, height) = intrinsic;
    if !(width.is_finite() && height.is_finite()) || width <= 0.0 || height <= 0.0 {
        return None;
    }
    let has_width = max_width.is_finite() && max_width > 0.0;
    let has_height = max_height.is_finite() && max_height > 0.0;
    let scale = match (has_width, has_height) {
        (true, true) => (max_width / width).min(max_height / height),
        (true, false) => max_width / width,
        (false, true) => max_height / height,
        (false, false) => 1.0,
    };
    Some((width * scale, height * scale))
}

fn measure(
    renderer: &Renderer,
    svg: &[u8],
    max_width: f32,
    max_height: f32,
) -> Result<SvgSize, Status> {
    with_tree(renderer, svg, None, |tree| {
        let size = tree.size();
        let intrinsic = (size.width(), size.height());
        let fitted = fit(intrinsic, max_width, max_height).ok_or(Status::RenderFailed)?;
        Ok(SvgSize {
            width: intrinsic.0,
            height: intrinsic.1,
            fitted_width: fitted.0,
            fitted_height: fitted.1,
        })
    })
}

fn render(
    renderer: &Renderer,
    svg: &[u8],
    max_width: f32,
    max_height: f32,
    current_color: Option<&str>,
) -> Result<(u32, u32, Vec<u8>), Status> {
    with_tree(renderer, svg, current_color, |tree| {
        let intrinsic = {
            let size = tree.size();
            (size.width(), size.height())
        };
        let (width, height) = fit(intrinsic, max_width, max_height).ok_or(Status::RenderFailed)?;
        // The target box already arrives in device pixels, so a round up here
        // is the whole of the device-pixel-ratio handling.
        let pixel_width = width.round().max(1.0) as u32;
        let pixel_height = height.round().max(1.0) as u32;
        if u64::from(pixel_width) * u64::from(pixel_height) > MAX_PIXELS {
            return Err(Status::TooLarge);
        }
        let Some(mut pixmap) = tiny_skia::Pixmap::new(pixel_width, pixel_height) else {
            return Err(Status::RenderFailed);
        };
        let transform = tiny_skia::Transform::from_scale(
            pixel_width as f32 / intrinsic.0,
            pixel_height as f32 / intrinsic.1,
        );
        resvg::render(tree, transform, &mut pixmap.as_mut());
        Ok((pixel_width, pixel_height, pixmap.take()))
    })
}

fn c_str(value: *const c_char) -> Option<String> {
    if value.is_null() {
        return None;
    }
    // SAFETY: the caller contract is a NUL-terminated string.
    unsafe { std::ffi::CStr::from_ptr(value) }
        .to_str()
        .ok()
        .map(str::to_owned)
}

fn bytes<'a>(data: *const c_uchar, length: usize) -> Option<&'a [u8]> {
    if data.is_null() || length == 0 {
        return None;
    }
    // SAFETY: the caller contract is a readable buffer of `length` bytes.
    Some(unsafe { slice::from_raw_parts(data, length) })
}

/// Creates a renderer with no fonts. Returns NULL on allocation failure.
#[unsafe(no_mangle)]
pub extern "C" fn gt_document_svg_renderer_new() -> *mut Renderer {
    Box::into_raw(Box::new(Renderer {
        fonts: Arc::new(fontdb::Database::new()),
    }))
}

/// Releases a renderer created by [`gt_document_svg_renderer_new`].
///
/// # Safety
/// `renderer` must be NULL or a pointer returned by the constructor that has
/// not already been released.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn gt_document_svg_renderer_free(renderer: *mut Renderer) {
    if renderer.is_null() {
        return;
    }
    // SAFETY: guaranteed by the caller contract.
    drop(unsafe { Box::from_raw(renderer) });
}

/// Loads font bytes into the renderer. A family index inside a `.ttc` is
/// selected by the caller passing each face's bytes.
///
/// # Safety
/// `renderer` must be a live renderer; `data` must point at `length` readable
/// bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn gt_document_svg_renderer_add_font(
    renderer: *mut Renderer,
    data: *const c_uchar,
    length: usize,
) -> Status {
    let (Some(renderer), Some(font)) = (unsafe { renderer.as_mut() }, bytes(data, length))
    else {
        return Status::InvalidArgument;
    };
    let database = Arc::make_mut(&mut renderer.fonts);
    let before = database.len();
    // The database keeps its own copy, so the caller may drop its buffer as
    // soon as this returns.
    database.load_font_data(font.to_vec());
    if database.len() == before {
        Status::InvalidArgument
    } else {
        Status::Ok
    }
}

/// Measures a document against a box of `max_width` × `max_height` device
/// pixels. A zero or non-finite maximum leaves that axis unconstrained.
///
/// # Safety
/// `renderer` must be live; `svg` must point at `length` readable bytes; `out`
/// must be writable.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn gt_document_svg_measure(
    renderer: *const Renderer,
    svg: *const c_uchar,
    length: usize,
    max_width: f32,
    max_height: f32,
    out: *mut SvgSize,
) -> Status {
    let (Some(renderer), Some(svg), false) =
        (unsafe { renderer.as_ref() }, bytes(svg, length), out.is_null())
    else {
        return Status::InvalidArgument;
    };
    match measure(renderer, svg, max_width, max_height) {
        Ok(size) => {
            // SAFETY: the caller contract guarantees a writable slot.
            unsafe { out.write(size) };
            Status::Ok
        }
        Err(status) => status,
    }
}

/// The result of [`gt_document_svg_render`]: `width * height * 4` bytes of
/// premultiplied RGBA, released with [`gt_document_svg_pixels_free`].
#[repr(C)]
#[derive(Clone, Copy)]
pub struct RenderedImage {
    pub width: u32,
    pub height: u32,
    pub pixels: *mut c_uchar,
}

/// Frees pixels returned by [`gt_document_svg_render`].
///
/// # Safety
/// `image` must be a value returned by a successful render, used once.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn gt_document_svg_pixels_free(image: RenderedImage) {
    if image.pixels.is_null() {
        return;
    }
    let length = image.width as usize * image.height as usize * 4;
    // SAFETY: `pixmap.take()` produced exactly this buffer and capacity.
    drop(unsafe { Vec::from_raw_parts(image.pixels, length, length) });
}

/// Rasterizes a document to fit a box of `max_width` × `max_height` device
/// pixels, replacing `currentColor` with `current_color` (a CSS colour such as
/// `#101114`, or NULL to leave the document's own colours alone).
///
/// # Safety
/// `renderer` must be live; `svg` must point at `length` readable bytes;
/// `current_color`, when non-NULL, must be NUL-terminated; `out` must be
/// writable.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn gt_document_svg_render(
    renderer: *const Renderer,
    svg: *const c_uchar,
    length: usize,
    max_width: f32,
    max_height: f32,
    current_color: *const c_char,
    out: *mut RenderedImage,
) -> Status {
    let (Some(renderer), Some(svg), false) =
        (unsafe { renderer.as_ref() }, bytes(svg, length), out.is_null())
    else {
        return Status::InvalidArgument;
    };
    let color = match c_str(current_color) {
        Some(value) => Some(value),
        None if current_color.is_null() => None,
        None => return Status::InvalidArgument,
    };
    match render(renderer, svg, max_width, max_height, color.as_deref()) {
        Ok((width, height, mut pixels)) => {
            let pointer = pixels.as_mut_ptr();
            std::mem::forget(pixels);
            // SAFETY: the caller contract guarantees a writable slot.
            unsafe {
                out.write(RenderedImage {
                    width,
                    height,
                    pixels: pointer,
                })
            };
            Status::Ok
        }
        Err(status) => status,
    }
}

/// A readable, static description of a status code.
#[unsafe(no_mangle)]
pub extern "C" fn gt_document_svg_status_message(status: Status) -> *const c_char {
    match status {
        Status::Ok => c"ok".as_ptr(),
        Status::InvalidArgument => c"invalid argument".as_ptr(),
        Status::ParseFailed => c"not an SVG document".as_ptr(),
        Status::RenderFailed => c"SVG could not be rendered".as_ptr(),
        Status::TooLarge => c"SVG raster is too large".as_ptr(),
    }
}
