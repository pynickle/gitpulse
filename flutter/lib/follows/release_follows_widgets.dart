import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../repositories/repository_navigation.dart';
import '../timeline/timeline_models.dart';
import 'language_colors.dart';
import 'release_follows_dto.dart';
import 'release_follows_state.dart';

const _cardRadius = 12.0;
const _cardGap = 8.0;
const _cardInset = 14.0;

/// Release Timeline card shell: ink paints the surface so a press stays visible.
class ReleaseFollowCard extends StatelessWidget {
  const ReleaseFollowCard({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final radius = BorderRadius.circular(_cardRadius);
    return Padding(
      padding: const EdgeInsets.only(bottom: _cardGap),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              border: Border.all(color: theme.dividerColor),
              borderRadius: radius,
              color: theme.colorScheme.surfaceContainerLow,
            ),
            child: Padding(
              padding: const EdgeInsets.all(_cardInset),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

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
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final repo = candidate.repository;
    final description = _visibleText(candidate.description);
    final language = _visibleText(candidate.language);
    return ReleaseFollowCard(
      onTap: () => openRepositoryPage(context, (
        owner: repo.owner,
        repository: repo.name,
        releases: false,
      )),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  repo.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium,
                ),
              ),
              _FollowIconButton(
                tooltip: followed ? l10n.followsUnfollow : l10n.followsFollow,
                icon: followed ? Icons.bookmark : Icons.bookmark_add_outlined,
                onPressed: onToggle,
              ),
            ],
          ),
          if (description != null) ...[
            const SizedBox(height: 6),
            Text(description, maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          _RepositoryMeta(language: language, stars: candidate.stargazersCount),
        ],
      ),
    );
  }
}

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
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final unavailable = status == RepositoryPageStatus.unavailable;
    final transient = status == RepositoryPageStatus.transient;
    final description = detailed && !unavailable && !transient
        ? _visibleText(details?.description)
        : null;
    final language = detailed && !unavailable && !transient
        ? _visibleText(details?.language)
        : null;
    final stars = detailed && !unavailable && !transient
        ? details?.starCount
        : null;
    return ReleaseFollowCard(
      onTap: unavailable
          ? null
          : () => openRepositoryPage(context, (
              owner: repository.owner,
              repository: repository.name,
              releases: false,
            )),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (unavailable) ...[
                Icon(
                  Icons.error_outline,
                  size: 18,
                  color: theme.colorScheme.error,
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  repository.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium,
                ),
              ),
              if (transient)
                _FollowIconButton(
                  tooltip: l10n.followsRetryMetadata(repository.fullName),
                  icon: Icons.refresh,
                  onPressed: enabled ? onRetry : null,
                ),
              _FollowIconButton(
                tooltip: l10n.followsUnfollow,
                icon: Icons.bookmark_remove_outlined,
                onPressed: enabled ? onUnfollow : null,
              ),
            ],
          ),
          if (unavailable) ...[
            const SizedBox(height: 4),
            Text(l10n.followsUnavailableLabel),
          ],
          if (description != null) ...[
            const SizedBox(height: 6),
            Text(description, maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          if (language != null || stars != null) ...[
            const SizedBox(height: 8),
            _RepositoryMeta(language: language, stars: stars),
          ],
        ],
      ),
    );
  }
}

class _RepositoryMeta extends StatelessWidget {
  const _RepositoryMeta({required this.language, required this.stars});

  final String? language;
  final int? stars;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodyMedium
        ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Row(
      children: [
        if (language != null) ...[
          LanguageSwatch(language: language!),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              language!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: muted,
            ),
          ),
        ],
        if (stars != null) ...[
          const Spacer(),
          Icon(
            Icons.star_border,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 4),
          Text(gitPulseLocaleCompactCount(context, stars!), style: muted),
        ],
      ],
    );
  }
}

class LanguageSwatch extends StatelessWidget {
  const LanguageSwatch({super.key, required this.language});

  final String language;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        width: 10,
        height: 10,
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

class _FollowIconButton extends StatelessWidget {
  const _FollowIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.all(8),
      constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
      icon: Icon(icon),
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
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Text(
        text,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
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
