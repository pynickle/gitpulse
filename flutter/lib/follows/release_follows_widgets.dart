import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../repositories/repository_navigation.dart';
import '../timeline/timeline_models.dart';
import 'language_colors.dart';
import 'release_follows_dto.dart';
import 'release_follows_state.dart';

/// The one gutter every Follows surface shares: the page controls, the
/// repository rows, and the rules between them. A single number, so nothing on
/// the page can sit a few pixels out of line with anything else.
const releaseFollowsPadding = 16.0;

/// One repository row's own vertical inset. Dense enough that a phone lists six
/// repositories without scrolling, tall enough that a row is a comfortable tap
/// target on its own.
const _rowPadding = 10.0;

/// The space between a row's language and its star count. Wide enough that a
/// long language name still reads as one datum and the count as another.
const _metaGap = 20.0;

/// The star glyph and the gap between it and its count.
const _starGlyph = 12.0;
const _starGap = 3.0;

/// The language column's width at the reader's text scale: the swatch, the gap
/// after it, and a language name of ordinary length.
///
/// Giving the language one fixed column is what lets the count beside it start
/// at the same x down the whole list; a longer name is ellipsized inside it
/// rather than allowed to push every count out of line.
double _languageColumnWidth(BuildContext context) {
  final scale = MediaQuery.textScalerOf(context).scale(11) / 11;
  return 68 * scale + 14;
}

/// How wide the star column is at the reader's text scale.
///
/// Its count is left-aligned, so the star itself starts at one x down the whole
/// list, and the column widens with the type so a scaled-up count is never
/// clipped.
double _countColumnWidth(BuildContext context) {
  final scale = MediaQuery.textScalerOf(context).scale(11) / 11;
  return 44 * scale + _starGlyph + _starGap;
}

/// One repository, as a row of a list rather than a card.
///
/// Identity runs down the left in reading order — the name, the description,
/// then one metadata line naming the language and the star count — while the
/// right edge belongs to the row's action alone. [FollowRowDivider] separates
/// one row from the next, so a page of repositories reads as one list instead
/// of a stack of boxes.
class _RepositoryRow extends StatelessWidget {
  const _RepositoryRow({
    required this.name,
    this.description,
    this.language,
    this.stars,
    this.unavailable = false,
    this.unavailableLabel,
    this.actions = const [],
    this.onTap,
  });

  final String name;
  final String? description;
  final String? language;

  /// The repository's star count, or null when it is not known yet.
  final int? stars;

  final bool unavailable;
  final String? unavailableLabel;
  final List<Widget> actions;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final meta = theme.textTheme.labelSmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final count = stars == null
        ? null
        : gitPulseLocaleCompactCount(context, stars!);
    final hasMeta =
        language != null || count != null || unavailableLabel != null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            releaseFollowsPadding,
            _rowPadding,
            8,
            _rowPadding,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        if (unavailable) ...[
                          ExcludeSemantics(
                            child: Icon(
                              Icons.error_outline,
                              size: 14,
                              color: scheme.error,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (description != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (hasMeta) ...[
                      const SizedBox(height: 3),
                      _MetaLine(
                        style: meta,
                        language: language,
                        count: count,
                        unavailableLabel: unavailableLabel,
                      ),
                    ],
                  ],
                ),
              ),
              ...actions,
            ],
          ),
        ),
      ),
    );
  }
}

/// The metadata line under a repository's name: the language and the star
/// count, each in a column of its own.
///
/// The language column has one width for every row, so the star count beside it
/// starts at the same x down the whole list — close enough to the language to
/// belong to it, far enough to read as its own figure. A language longer than
/// the column is ellipsized instead of pushing every count out of line, and a
/// row with nothing to show leaves the column empty so the counts above and
/// below still agree.
class _MetaLine extends StatelessWidget {
  const _MetaLine({
    required this.style,
    this.language,
    this.count,
    this.unavailableLabel,
  });

  final TextStyle? style;
  final String? language;

  /// The star count, already formatted for the reader's language.
  final String? count;

  final String? unavailableLabel;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final swatch = language == null
        ? const SizedBox.shrink()
        : Row(
            children: [
              LanguageSwatch(language: language!),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  language!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: style,
                ),
              ),
            ],
          );
    return Row(
      children: [
        if (language != null || count != null)
          Flexible(
            child: SizedBox(
              // Without a count there is no column to keep, and the language
              // may use the whole line.
              width: count == null ? null : _languageColumnWidth(context),
              child: swatch,
            ),
          ),
        if (unavailableLabel != null)
          Flexible(
            child: Text(
              unavailableLabel!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: style?.copyWith(color: scheme.error),
            ),
          ),
        if (count != null) ...[
          const SizedBox(width: _metaGap),
          SizedBox(
            width: _countColumnWidth(context),
            child: Row(
              children: [
                ExcludeSemantics(
                  child: Icon(
                    Icons.star_border,
                    size: _starGlyph,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: _starGap),
                Expanded(
                  child: Text(
                    count!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: style,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// A repository to follow, found among the account's starred repositories or by
/// search. Its action toggles the Release Follow without opening the repository
/// the row itself opens.
class FollowRepositoryCard extends StatelessWidget {
  const FollowRepositoryCard({
    super.key,
    required this.candidate,
    required this.followed,
    required this.onToggle,
  });

  final RepositoryCandidateDto candidate;
  final bool followed;
  final VoidCallback? onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final repo = candidate.repository;
    return _RepositoryRow(
      name: repo.fullName,
      description: _visibleText(candidate.description),
      language: _visibleText(candidate.language),
      stars: candidate.stargazersCount,
      onTap: () => openRepositoryPage(context, (
        owner: repo.owner,
        repository: repo.name,
        releases: false,
      )),
      actions: [
        _FollowAction(
          tooltip: followed ? l10n.followsUnfollow : l10n.followsFollow,
          icon: followed ? Icons.bookmark : Icons.bookmark_add_outlined,
          emphasized: followed,
          onPressed: onToggle,
        ),
      ],
    );
  }
}

/// One Release Follow. Compact View is the identity alone; Detailed View adds
/// the description, language, and star count the metadata lookup found.
class FollowedRepositoryCard extends StatelessWidget {
  const FollowedRepositoryCard({
    super.key,
    required this.repository,
    required this.detailed,
    required this.status,
    required this.details,
    required this.enabled,
    required this.onUnfollow,
    required this.onRetry,
  });

  final TimelineRepository repository;
  final bool detailed;
  final RepositoryPageStatus? status;
  final FollowedRepositoryDetails? details;
  final bool enabled;
  final VoidCallback onUnfollow;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final unavailable = status == RepositoryPageStatus.unavailable;
    final transient = status == RepositoryPageStatus.transient;
    final known = detailed && !unavailable && !transient;
    return _RepositoryRow(
      name: repository.fullName,
      description: known ? _visibleText(details?.description) : null,
      language: known ? _visibleText(details?.language) : null,
      stars: known ? details?.starCount : null,
      unavailable: unavailable,
      unavailableLabel: unavailable ? l10n.followsUnavailableLabel : null,
      onTap: unavailable
          ? null
          : () => openRepositoryPage(context, (
              owner: repository.owner,
              repository: repository.name,
              releases: false,
            )),
      actions: [
        if (transient)
          _FollowAction(
            tooltip: l10n.followsRetryMetadata(repository.fullName),
            icon: Icons.refresh,
            onPressed: enabled ? onRetry : null,
          ),
        _FollowAction(
          tooltip: l10n.followsUnfollow,
          icon: Icons.bookmark_remove_outlined,
          onPressed: enabled ? onUnfollow : null,
        ),
      ],
    );
  }
}

/// A row's single action.
///
/// A followed repository carries a filled mark in the accent colour, so the
/// list answers "what am I already following" before a row is read; everything
/// else stays muted so the action never competes with the repository's name.
class _FollowAction extends StatelessWidget {
  const _FollowAction({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.emphasized = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      iconSize: 20,
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.all(8),
      constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
      color: emphasized ? scheme.primary : scheme.onSurfaceVariant,
      icon: Icon(icon),
    );
  }
}

/// The hairline between two repositories, inset to the text gutter so the list
/// reads as one table rather than a stack of boxes.
class FollowRowDivider extends StatelessWidget {
  const FollowRowDivider({super.key});

  @override
  Widget build(BuildContext context) => Divider(
    height: 1,
    thickness: 1,
    indent: releaseFollowsPadding,
    endIndent: releaseFollowsPadding,
    color: Theme.of(context).dividerColor,
  );
}

class LanguageSwatch extends StatelessWidget {
  const LanguageSwatch({super.key, required this.language});

  final String language;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: 9,
        height: 9,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: languageColor(language),
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

class FollowProblemNotice extends StatelessWidget {
  const FollowProblemNotice({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(
        releaseFollowsPadding,
        8,
        releaseFollowsPadding,
        8,
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: Theme.of(context).colorScheme.error),
      ),
    ),
  );
}

String followProblemLabel(
  AppLocalizations l10n,
  FollowProblem? problem, {
  bool save = false,
}) => switch (problem) {
  FollowProblem.invalidRepository => l10n.followsInvalid,
  FollowProblem.notFound => l10n.followsNotFound,
  FollowProblem.duplicate => l10n.followsDuplicate,
  FollowProblem.validLimit => l10n.followsValidLimit,
  FollowProblem.storedLimit => l10n.followsStoredLimit,
  FollowProblem.network => l10n.followsNetwork,
  FollowProblem.rateLimited => l10n.timelineErrorRateLimited,
  _ => save ? l10n.followsSaveFailed : l10n.followsLoadFailed,
};

String? _visibleText(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}
