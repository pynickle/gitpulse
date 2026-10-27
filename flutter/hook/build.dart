import 'package:hooks/hooks.dart';
import 'package:native_toolchain_rust/native_toolchain_rust.dart';

/// Builds the document SVG renderer (ADR 0027) once per target architecture.
///
/// Cargo then produces the `.so`, `.dll` or `.dylib` for the target and the
/// hook routes it into the app bundle, so no build machine copies a binary by
/// hand. The Rust crate lives in `native/document_svg`; its pinned toolchain is
/// `native/document_svg/rust-toolchain.toml`.
void main(List<String> args) async {
  await build(args, (input, output) async {
    await RustBuilder(
      assetName: 'src/document_svg_ffi.dart',
      cratePath: 'native/document_svg',
    ).run(input: input, output: output);
  });
}
