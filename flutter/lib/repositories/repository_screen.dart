import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../releases/document_content.dart';
import '../releases/release_document.dart';
import '../session/session_controller.dart';
import '../session/sign_in_panel.dart';
import 'repository_dto.dart';
import 'repository_navigation.dart';
import 'repository_service.dart';

class RepositoryScreen extends ConsumerStatefulWidget {
  const RepositoryScreen({
    super.key,
    required this.owner,
    required this.repository,
  });
  final String owner;
  final String repository;
  @override
  ConsumerState<RepositoryScreen> createState() => _RepositoryScreenState();
}

class _RepositoryScreenState extends ConsumerState<RepositoryScreen> {
  final _opening = Object();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final scope = (
      owner: widget.owner,
      repository: widget.repository,
      opening: _opening,
    );
    final result = ref.watch(repositoryProvider(scope));
    return Scaffold(
      appBar: RepositoryPageAppBar(title: l10n.repositoryTitle),
      body: SafeArea(
        child: Column(
          children: [
            const SessionNotice(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: session.phase != SessionPhase.signedIn
                    ? const SignInPanel()
                    : result.when(
                        skipLoadingOnRefresh: false,
                        loading: () =>
                            const Center(child: CircularProgressIndicator()),
                        error: (_, _) => RepositoryFailureView(
                          failure: RepositoryFailure.server,
                          onRetry: () =>
                              ref.invalidate(repositoryProvider(scope)),
                        ),
                        data: (data) => data.value == null
                            ? RepositoryFailureView(
                                failure: data.failure!,
                                onRetry: () =>
                                    ref.invalidate(repositoryProvider(scope)),
                              )
                            : _overview(data.value!, l10n),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _overview(RepositoryDto repository, AppLocalizations l10n) {
    final readmeScope = (
      repository: (
        owner: repository.owner.login,
        repository: repository.name,
        opening: _opening,
      ),
      branch: repository.defaultBranch,
    );
    final readme = ref.watch(repositoryReadmeProvider(readmeScope));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectableText(
          repository.fullName,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        if (repository.description?.isNotEmpty == true)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: SelectableText(repository.description!),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            Chip(label: Text(l10n.repositoryStars(repository.stargazersCount))),
            Chip(label: Text(l10n.repositoryForks(repository.forksCount))),
            if (repository.subscribersCount case final count?)
              Chip(label: Text(l10n.repositoryWatchers(count))),
            if (repository.language case final language?)
              Chip(label: Text(language)),
          ],
        ),
        TextButton.icon(
          onPressed: () => openRepositoryPage(context, (
            owner: repository.owner.login,
            repository: repository.name,
            releases: true,
          )),
          icon: const Icon(Icons.list_alt),
          label: Text(l10n.repositoryReleasesTitle),
        ),
        const Divider(height: 32),
        Text('README', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        readme.when(
          skipLoadingOnRefresh: false,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => RepositoryFailureView(
            failure: RepositoryFailure.server,
            onRetry: () =>
                ref.invalidate(repositoryReadmeProvider(readmeScope)),
          ),
          data: (data) {
            if (data.value == null) {
              return RepositoryFailureView(
                failure: data.failure!,
                onRetry: () =>
                    ref.invalidate(repositoryReadmeProvider(readmeScope)),
              );
            }
            final dto = data.value!;
            if (dto.content == null || dto.content!.trim().isEmpty) {
              return Text(l10n.repositoryNoReadme);
            }
            return ReleaseDocument(
              source: dto.content!,
              document: RepositoryDocumentContext(
                owner: repository.owner.login,
                repository: repository.name,
                ref: repository.defaultBranch,
                documentPath: dto.path!,
              ),
              onTapUrl: (url) => openNativeContentLink(context, ref, url),
            );
          },
        ),
      ],
    );
  }
}

class RepositoryFailureView extends StatelessWidget {
  const RepositoryFailureView({
    super.key,
    required this.failure,
    required this.onRetry,
  });
  final RepositoryFailure failure;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Text(switch (failure) {
          RepositoryFailure.unavailable => l10n.repositoryUnavailable,
          RepositoryFailure.permission => l10n.repositoryPermission,
          RepositoryFailure.network => l10n.timelineErrorNetwork,
          RepositoryFailure.rateLimited => l10n.timelineErrorRateLimited,
          RepositoryFailure.session => l10n.sessionExpired,
          _ => l10n.repositoryFailed,
        }),
        OutlinedButton(onPressed: onRetry, child: Text(l10n.timelineRetry)),
      ],
    );
  }
}
