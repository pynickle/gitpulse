import 'package:flutter/material.dart';

import 'gitpulse_avatar.dart';
import 'gitpulse_tokens.dart';

/// A Release's author, as the release header introduces them: the picture, the
/// handle, and the date it was published.
///
/// It is a sentence rather than a key-value row — "danyaber ezun · 3 hours ago" —
/// so the picture takes the booking a name's capital takes, the handle is set
/// with its date in the tone a supporting line reads, and whatever space is
/// between them is the date's to take before the line ellipsises. The instant
/// itself never disappears while it fits: the words say how long ago, and a
/// reader who needs the moment is given it by the release's meta line.
///
/// The picture carries no semantics of its own. A screen reader hears the author
/// once, from the handle beside it.
class GitPulseReleaseArtist extends StatelessWidget {
  const GitPulseReleaseArtist({
    super.key,
    required this.login,
    required this.avatarUrl,
    required this.publishedAt,
  });

  /// The author's handle, drawn as the name the release is signed with.
  final String login;

  /// The author's avatar, when one is known.
  final String? avatarUrl;

  /// When the release was published, in the words a reader hears as "3 hours
  /// ago". Null draws the handle alone.
  final String? publishedAt;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        GitPulseAvatar(url: avatarUrl, size: GitPulseAvatarSize.artist),
        const SizedBox(width: GitPulseSpace.dense),
        // The name is the line's own ink; the handle takes the muted tone the
        // web Release Drawer sets it in, so the two clients sign a release the
        // same way.
        Text(
          login,
          maxLines: 1,
          style: gitPulseTypeMeta(context)
              ?.copyWith(color: toneTextMuted(context)),
        ),
        if (publishedAt case final publishedAt?) ...[
          const SizedBox(width: GitPulseSpace.dense),
          // The separator belongs to the date rather than to a control: it is
          // never read aloud on its own, and it gives way before the handle does.
          ExcludeSemantics(child: Text('·', style: gitPulseTypeMeta(context))),
          const SizedBox(width: GitPulseSpace.dense),
          Flexible(
            child: Semantics(
              label: publishedAt,
              child: ExcludeSemantics(
                child: Text(
                  publishedAt,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: gitPulseTypeMeta(context),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
