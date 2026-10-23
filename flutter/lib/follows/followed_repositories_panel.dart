import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_state_views.dart';
import '../repositories/repository_navigation.dart';
import '../timeline/timeline_models.dart';
import 'release_follows_session.dart';
import 'release_follows_widgets.dart';

class FollowedRepositoriesPanel extends ConsumerWidget {
  const FollowedRepositoriesPanel({super.key, this.onClose});
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(releaseFollowsSessionProvider);
    final facade = ref.read(releaseFollowsSessionProvider.notifier);
    final l10n = AppLocalizations.of(context);
    final disabled = state.loading || state.saving;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  l10n.followsCurrent(state.repositories.length),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              IconButton(
                tooltip: l10n.followsReload,
                onPressed: disabled ? null : facade.reload,
                icon: const Icon(Icons.refresh),
              ),
              if (onClose != null)
                IconButton(
                  tooltip: l10n.followsClose,
                  onPressed: onClose,
                  icon: const Icon(Icons.close),
                ),
            ],
          ),
        ),
        if (disabled) const LinearProgressIndicator(),
        const Divider(height: 1),
        Expanded(
          child: CustomScrollView(
            primary: false,
            slivers: [
              if (state.problem != null)
                SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FollowProblemNotice(
                        text: followProblemLabel(
                          l10n,
                          state.problem,
                          save: state.saveFailed,
                        ),
                      ),
                      if (!state.saveFailed)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: TextButton(
                            onPressed: disabled ? null : facade.reload,
                            child: Text(l10n.timelineRetry),
                          ),
                        ),
                    ],
                  ),
                ),
              if (state.metadataProblem != null)
                SliverToBoxAdapter(
                  child: FollowProblemNotice(text: l10n.followsLookupFailed),
                ),
              if (!state.loaded && state.loading)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: GitPulseLoadingView(label: l10n.followsLoading),
                )
              else if (state.loaded && state.repositories.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: GitPulseMessageView(
                    icon: Icons.bookmarks_outlined,
                    title: l10n.followsEmpty,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.all(8),
                  sliver: SliverList.builder(
                    itemCount: state.repositories.length,
                    itemBuilder: (context, index) {
                      final repo = state.repositories[index];
                      final previous = state.previousNames[repo.id];
                      final status = state.statuses[repo.id];
                      final description = switch (status) {
                        RepositoryPageStatus.unavailable =>
                          l10n.followsUnavailable,
                        RepositoryPageStatus.transient => l10n.followsTransient,
                        _ =>
                          previous == null
                              ? null
                              : l10n.followsRenamed(previous),
                      };
                      return Card.outlined(
                        key: ValueKey('followed-${repo.id}'),
                        clipBehavior: Clip.antiAlias,
                        child: ListTile(
                          title: Text(
                            repo.fullName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: description == null
                              ? null
                              : Text(description),
                          onTap: status == RepositoryPageStatus.unavailable
                              ? null
                              : () => openRepositoryPage(context, (
                                  owner: repo.owner,
                                  repository: repo.name,
                                  releases: false,
                                )),
                          trailing: IconButton(
                            tooltip: l10n.followsUnfollow,
                            onPressed: disabled
                                ? null
                                : () => facade.unfollow(repo.id),
                            icon: const Icon(Icons.bookmark_remove_outlined),
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
