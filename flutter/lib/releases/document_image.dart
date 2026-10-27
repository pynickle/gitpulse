import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'document_image_provider.dart';

/// Shows one document image at the size the author asked for.
///
/// Three rules keep README images readable:
/// - an explicit `width`/`height` is the display size, and the other axis
///   follows the image's own aspect ratio (`BoxFit.contain`, never `fill`);
/// - an image with no size keeps its intrinsic size, and is never grown past
///   the reading column, so it shrinks on a phone instead of overflowing;
/// - a failed load leaves the alt text where the image would be.
class DocumentImage extends StatelessWidget {
  const DocumentImage({
    super.key,
    required this.provider,
    required this.onError,
    this.semanticLabel,
    this.width,
    this.height,
  });

  final DocumentImageProvider provider;
  final String? semanticLabel;
  final double? width;
  final double? height;
  final WidgetBuilder onError;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final available = constraints.maxWidth.isFinite
          ? constraints.maxWidth
          : MediaQuery.sizeOf(context).width;
      final displayWidth = width == null ? null : math.min(width!, available);
      return Image(
        image: provider,
        width: displayWidth,
        height: height,
        fit: width != null && height != null ? BoxFit.contain : null,
        // Intrinsic-size images are capped at the reading column and keep their
        // aspect ratio; Flutter shrinks them only when they would overflow.
        frameBuilder: (context, child, frame, wasSynchronouslyLoaded) => child,
        semanticLabel: semanticLabel,
        excludeFromSemantics: semanticLabel == null,
        errorBuilder: (context, error, stack) => onError(context),
      );
    },
  );
}
