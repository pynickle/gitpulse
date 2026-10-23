import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../repositories/repository_navigation.dart';
import 'release_follows_dto.dart';
import 'release_follows_state.dart';

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
    return Card.outlined(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => openRepositoryPage(context, (
          owner: repo.owner,
          repository: repo.name,
          releases: false,
        )),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.book_outlined, color: theme.colorScheme.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      repo.fullName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              if (candidate.description case final description?
                  when description.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(description, maxLines: 3, overflow: TextOverflow.ellipsis),
              ],
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (candidate.language case final language?) Text(language),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_border, size: 18),
                      const SizedBox(width: 4),
                      Text(gitPulseCount(context, candidate.stargazersCount)),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: onToggle,
                    icon: Icon(followed ? Icons.check : Icons.add),
                    label: Text(
                      followed ? l10n.followsFollowed : l10n.followsFollow,
                    ),
                  ),
                ],
              ),
            ],
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
