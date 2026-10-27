//! Behaviour tests for the rendering core, driven by the fixed document
//! fixtures in `tests/fixtures` (copied byte-for-byte from
//! `docs/research/fixtures/readme-rendering`).
//!
//! These exercise the crate directly. The Flutter suite
//! (`flutter test test/releases/`) covers the same inputs through the real
//! compiled dynamic library and the mounted document, so the two ends of the
//! boundary are both proven.

use std::ffi::CString;
use std::path::{Path, PathBuf};
use std::ptr;

use gitpulse_document_svg::{
    RenderedImage, Renderer, Status, SvgSize, gt_document_svg_measure, gt_document_svg_pixels_free,
    gt_document_svg_render, gt_document_svg_renderer_add_font, gt_document_svg_renderer_free, gt_document_svg_renderer_new,
};

fn fixture(name: &str) -> Vec<u8> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name);
    std::fs::read(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// A deterministic, freely distributable font for the text assertions.
///
/// `GITPULSE_TEST_FONT` wins. Otherwise a DejaVu or Liberation face is used
/// from the platform's own font directory. Expectations below are about glyph
/// coverage and equal scaling, never exact glyph widths, so they hold for any
/// of those faces.
fn test_font() -> Option<Vec<u8>> {
    let candidates: Vec<PathBuf> = std::env::var_os("GITPULSE_TEST_FONT")
        .map(PathBuf::from)
        .into_iter()
        .chain(
            [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                "/usr/share/fonts/dejavu/DejaVuSans.ttf",
                "C:\\Windows\\Fonts\\DejaVuSans.ttf",
                // Developer-host fallback only; CI and other hosts use a
                // DejaVu or Liberation face from the list above.
                "C:\\Windows\\Fonts\\verdana.ttf",
            ]
            .map(PathBuf::from),
        )
        .collect();
    candidates
        .iter()
        .find(|path| path.is_file())
        .and_then(|path| std::fs::read(path).ok())
}

/// Owns a renderer created by the C constructor, so it is released once.
struct BoxedRenderer(*mut Renderer);

impl std::ops::Deref for BoxedRenderer {
    type Target = Renderer;
    fn deref(&self) -> &Renderer {
        // SAFETY: the pointer is live for as long as the wrapper is.
        unsafe { &*self.0 }
    }
}

impl Drop for BoxedRenderer {
    fn drop(&mut self) {
        // SAFETY: released exactly once, by the owner.
        unsafe { gt_document_svg_renderer_free(self.0) };
    }
}

fn renderer() -> BoxedRenderer {
    // SAFETY: the constructor returns an owned, non-null pointer.
    let renderer = BoxedRenderer(unsafe { gt_document_svg_renderer_new() });
    if let Some(font) = test_font() {
        // SAFETY: live renderer, readable buffer of `font.len()` bytes.
        let status =
            unsafe { gt_document_svg_renderer_add_font(renderer.0, font.as_ptr(), font.len()) };
        assert_eq!(status, Status::Ok, "the test font must load");
    }
    renderer
}

fn measure_box(renderer: &Renderer, svg: &[u8], width: f32, height: f32) -> SvgSize {
    let mut size = SvgSize {
        width: 0.0,
        height: 0.0,
        fitted_width: 0.0,
        fitted_height: 0.0,
    };
    // SAFETY: live renderer, readable input, writable output.
    let status = unsafe {
        gt_document_svg_measure(
            renderer as *const Renderer,
            svg.as_ptr(),
            svg.len(),
            width,
            height,
            &mut size,
        )
    };
    assert_eq!(status, Status::Ok);
    size
}

fn render(renderer: &Renderer, svg: &[u8], width: f32, height: f32, color: Option<&str>) -> Raster {
    let color = color.map(|value| CString::new(value).unwrap());
    let mut image = RenderedImage {
        width: 0,
        height: 0,
        pixels: ptr::null_mut(),
    };
    // SAFETY: live renderer, readable input, NUL-terminated colour or NULL,
    // writable output.
    let status = unsafe {
        gt_document_svg_render(
            renderer as *const Renderer,
            svg.as_ptr(),
            svg.len(),
            width,
            height,
            color.as_ref().map_or(ptr::null(), |value| value.as_ptr()),
            &mut image,
        )
    };
    assert_eq!(status, Status::Ok);
    Raster::take(image)
}

struct Raster {
    width: u32,
    height: u32,
    /// Premultiplied RGBA, exactly `width * height * 4` bytes.
    pixels: Vec<u8>,
}

impl Raster {
    fn take(image: RenderedImage) -> Raster {
        let (width, height) = (image.width, image.height);
        // SAFETY: the renderer allocated exactly this many bytes.
        let pixels = unsafe {
            std::slice::from_raw_parts(image.pixels, width as usize * height as usize * 4)
        }
        .to_vec();
        // SAFETY: released exactly once, immediately.
        unsafe { gt_document_svg_pixels_free(image) };
        Raster {
            width,
            height,
            pixels,
        }
    }

    fn at(&self, x: u32, y: u32) -> [u8; 4] {
        let offset = ((y * self.width + x) * 4) as usize;
        [
            self.pixels[offset],
            self.pixels[offset + 1],
            self.pixels[offset + 2],
            self.pixels[offset + 3],
        ]
    }

    /// Counts painted pixels whose colour satisfies `matches`.
    fn count(&self, matches: impl Fn([u8; 4]) -> bool) -> usize {
        self.pixels
            .chunks_exact(4)
            .map(|pixel| [pixel[0], pixel[1], pixel[2], pixel[3]])
            .filter(|pixel| matches(*pixel))
            .count()
    }

    fn count_in(&self, x: u32, y: u32, width: u32, height: u32, matches: impl Fn([u8; 4]) -> bool) -> usize {
        let mut found = 0;
        for row in y..(y + height).min(self.height) {
            for column in x..(x + width).min(self.width) {
                if matches(self.at(column, row)) {
                    found += 1;
                }
            }
        }
        found
    }
}

fn is_white(pixel: [u8; 4]) -> bool {
    pixel[3] > 0 && pixel[0] > 200 && pixel[1] > 200 && pixel[2] > 200
}

/// Replaces the first `textLength` value, to prove the attribute takes effect.
fn with_text_length(svg: &str, from: &str, to: &str) -> String {
    svg.replacen(&format!("textLength=\"{from}\""), &format!("textLength=\"{to}\""), 1)
}

/// Removes the embedded `<image>` logo, leaving the text intact.
fn without_embedded_logo(svg: &str) -> String {
    let start = svg.find("<image").expect("shield carries an embedded logo");
    let end = svg[start..].find("/>").expect("the logo element closes") + start + 2;
    format!("{}{}", &svg[..start], &svg[end..])
}

#[test]
fn measures_the_badge_at_its_intrinsic_size_and_shrinks_to_a_narrow_box() {
    let renderer = renderer();
    let svg = fixture("shield.svg");
    let wide = measure_box(&renderer, &svg, 0.0, 0.0);
    assert_eq!((wide.width, wide.height), (119.0, 20.0));
    assert_eq!(
        (wide.fitted_width, wide.fitted_height),
        (119.0, 20.0),
        "an unconstrained measurement reports the badge's own size"
    );
    let narrow = measure_box(&renderer, &svg, 59.5, 0.0);
    assert_eq!((narrow.fitted_width, narrow.fitted_height), (59.5, 10.0));
}

#[test]
fn rasterizes_the_full_badge_at_device_density() {
    let renderer = renderer();
    let svg = fixture("shield.svg");
    // Four device pixels per document pixel, as a DPR-4 phone asks for.
    let image = render(&renderer, &svg, 119.0 * 4.0, 20.0 * 4.0, None);
    assert_eq!((image.width, image.height), (476, 80));

    // Label text lands inside the dark segment and is nowhere cropped into the
    // badge's outer rows, which is what the old backend painted across the
    // whole viewport.
    let label_white = image.count_in(8, 8, 256, 64, is_white);
    assert!(label_white > 200, "version text is painted: {label_white}");
    assert_eq!(
        image.count_in(0, 0, image.width, 6, is_white),
        0,
        "no glyph overflows the badge's top edge"
    );
    assert_eq!(
        image.count_in(0, image.height - 6, image.width, 6, is_white),
        0,
        "no glyph overflows the badge's bottom edge"
    );

    // The embedded GitHub logo is really drawn: removing it changes pixels in
    // the logo region.
    let bare = without_embedded_logo(std::str::from_utf8(&svg).unwrap());
    let bare_image = render(&renderer, bare.as_bytes(), 119.0 * 4.0, 20.0 * 4.0, None);
    let logo_start = 5 * 4;
    let logo_size = 14 * 4;
    let changed = (0..logo_size)
        .flat_map(|row| (0..logo_size).map(move |column| (column, row)))
        .filter(|(column, row)| {
            image.at(logo_start + column, 3 * 4 + row) != bare_image.at(logo_start + column, 3 * 4 + row)
        })
        .count();
    assert!(changed > 100, "the embedded logo is painted: {changed} pixels");
}

#[test]
fn text_length_widens_the_painted_text() {
    let renderer = renderer();
    let bytes = fixture("shield.svg");
    let source = std::str::from_utf8(&bytes).unwrap();
    // Keep only the first run so the measurement is that run's own width; the
    // version half is anchored at the badge's fixed right edge either way.
    let first_run = |svg: &str| {
        let start = svg.find("<text").unwrap();
        let end = svg.rfind("<text").unwrap();
        format!("{}<g fill=\"#fff\" font-size=\"110\" text-anchor=\"middle\">{}</g></svg>",
            &svg[..svg.find("<g fill=").unwrap()], &svg[start..end])
    };
    let narrow_source = first_run(source);
    let narrow = render(&renderer, narrow_source.as_bytes(), 119.0 * 4.0, 20.0 * 4.0, None);
    let wide_source = first_run(&with_text_length(source, "390", "780"));
    let wide = render(&renderer, wide_source.as_bytes(), 119.0 * 4.0, 20.0 * 4.0, None);
    // `lengthAdjust` defaults to spacing, so the glyphs keep their size and the
    // run widens: compare the horizontal extent the label covers.
    let narrow_span = label_span(&narrow);
    let wide_span = label_span(&wide);
    assert!(
        wide_span > narrow_span * 3 / 2,
        "doubling textLength widens the label: {narrow_span} -> {wide_span}"
    );
}

/// The horizontal extent of painted glyph pixels in the dark label half.
fn label_span(image: &Raster) -> u32 {
    let mut left = None;
    let mut right = 0;
    for row in 0..image.height {
        for column in 0..image.width {
            if is_white(image.at(column, row)) {
                left.get_or_insert(column);
                right = right.max(column);
            }
        }
    }
    right - left.unwrap_or(0)
}

#[test]
fn scaled_text_covers_the_same_area_as_an_unscaled_equivalent() {
    let renderer = renderer();
    let transformed = render(
        &renderer,
        &fixture("text-transform.svg"),
        119.0 * 4.0,
        20.0 * 4.0,
        None,
    );
    let unscaled = render(
        &renderer,
        &fixture("text-unscaled.svg"),
        119.0 * 4.0,
        20.0 * 4.0,
        None,
    );
    let scaled_white = transformed.count(is_white);
    let unscaled_white = unscaled.count(is_white);
    assert!(scaled_white > 200, "transformed text is painted");
    let ratio = scaled_white as f64 / unscaled_white.max(1) as f64;
    assert!(
        (0.5..2.0).contains(&ratio),
        "scale(.1) text keeps an equivalent size instead of filling the \
         viewport: {scaled_white} vs {unscaled_white}"
    );
}

#[test]
fn current_color_follows_the_theme_and_explicit_colors_survive() {
    let renderer = renderer();
    let logo = fixture("logo.svg");
    let themed = render(&renderer, &logo, 64.0, 64.0, Some("#ff0000"));
    assert_eq!(
        themed.at(4, 32),
        [255, 0, 0, 255],
        "the currentColor half takes the theme colour"
    );
    assert_eq!(
        themed.at(60, 32),
        [0, 255, 0, 255],
        "the explicit green half keeps its own colour"
    );

    // The badge's own `fill="#fff"` is explicit, so a red theme must not tint it.
    let badge = render(&renderer, &fixture("shield.svg"), 119.0 * 4.0, 20.0 * 4.0, Some("#ff0000"));
    assert!(
        badge.count_in(0, 0, badge.width, badge.height, is_white) > 200,
        "explicit white badge text is not replaced by the theme colour"
    );
}

#[test]
fn an_unreadable_document_reports_a_parse_failure() {
    let renderer = renderer();
    let mut image = RenderedImage {
        width: 0,
        height: 0,
        pixels: ptr::null_mut(),
    };
    let junk = b"this is not an svg document";
    // SAFETY: live renderer, readable input, writable output.
    let status = unsafe {
        gt_document_svg_render(
            renderer.0 as *const Renderer,
            junk.as_ptr(),
            junk.len(),
            100.0,
            100.0,
            ptr::null(),
            &mut image,
        )
    };
    assert_eq!(status, Status::ParseFailed);
    assert!(image.pixels.is_null());
}

#[test]
fn repeated_renders_of_the_same_input_agree() {
    let renderer = renderer();
    let svg = fixture("shield.svg");
    let first = render(&renderer, &svg, 476.0, 80.0, Some("#101114"));
    let second = render(&renderer, &svg, 476.0, 80.0, Some("#101114"));
    assert_eq!(first.pixels, second.pixels);
}

#[test]
fn a_document_without_fonts_still_renders_its_shapes() {
    // No font is loaded into this renderer, mirroring a host whose font scan
    // found nothing: the badge shapes must still paint rather than fail.
    let bare = BoxedRenderer(unsafe { gt_document_svg_renderer_new() });
    let image = render(&bare, &fixture("shield.svg"), 119.0, 20.0, None);
    assert_eq!(image.at(2, 2), [0x16, 0x18, 0x1d, 255]);
    assert_eq!(image.at(118, 2), [0x2e, 0xa4, 0x4f, 255]);
}
