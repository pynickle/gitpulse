import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/session_controller.dart';
import 'repository_releases_dto.dart';
import 'repository_releases_service.dart';

typedef RepositoryReleasesScope = ({
  String owner,
  String repository,
  Object opening,
});

enum RepositoryReleaseFilter { all, stable, prerelease, draft }

class RepositoryReleasesState {
  const RepositoryReleasesState({
    this.page = 1,
    this.filter = RepositoryReleaseFilter.all,
    this.loading = true,
    this.data,
    this.failure,
  });

  final int page;
  final RepositoryReleaseFilter filter;
  final bool loading;
  final RepositoryReleasesPageDto? data;
  final RepositoryReleasesFailure? failure;

  List<RepositoryReleaseDto> get visibleItems => List.unmodifiable(
    (data?.items ?? <RepositoryReleaseDto>[]).where(
      (item) => switch (filter) {
        RepositoryReleaseFilter.all => true,
        RepositoryReleaseFilter.stable => !item.draft && !item.prerelease,
        RepositoryReleaseFilter.prerelease => !item.draft && item.prerelease,
        RepositoryReleaseFilter.draft => item.draft,
      },
    ),
  );
}

final repositoryReleasesControllerProvider = NotifierProvider.autoDispose
    .family<
      RepositoryReleasesController,
      RepositoryReleasesState,
      RepositoryReleasesScope
    >(RepositoryReleasesController.new);

class RepositoryReleasesController extends Notifier<RepositoryReleasesState> {
  RepositoryReleasesController(this.scope);

  final RepositoryReleasesScope scope;
  int _generation = 0;

  @override
  RepositoryReleasesState build() {
    final identity = ref.watch(
      sessionControllerProvider.select(
        (value) =>
            (value.phase, value.identity?.backend, value.identity?.login),
      ),
    );
    final generation = ++_generation;
    ref.onDispose(() => _generation++);
    if (identity.$1 != SessionPhase.signedIn) {
      return const RepositoryReleasesState(
        loading: false,
        failure: RepositoryReleasesFailure.session,
      );
    }
    scheduleMicrotask(() {
      if (ref.mounted && generation == _generation) loadPage(1);
    });
    return const RepositoryReleasesState();
  }

  void setFilter(RepositoryReleaseFilter filter) {
    state = RepositoryReleasesState(
      page: state.page,
      filter: filter,
      loading: state.loading,
      data: state.data,
      failure: state.failure,
    );
  }

  Future<void> loadPage(int page) async {
    final generation = ++_generation;
    state = RepositoryReleasesState(page: page, filter: state.filter);
    final service = RepositoryReleasesService(
      ({required method, required path}) => ref
          .read(sessionControllerProvider.notifier)
          .request(method: method, path: path),
    );
    RepositoryReleasesResult result;
    try {
      result = await service.load(
        owner: scope.owner,
        repository: scope.repository,
        page: page,
      );
    } catch (_) {
      result = const RepositoryReleasesResult.failed(
        RepositoryReleasesFailure.server,
      );
    }
    if (!ref.mounted || generation != _generation) return;
    state = RepositoryReleasesState(
      page: result.page?.pagination.page ?? page,
      filter: state.filter,
      loading: false,
      data: result.page,
      failure: result.failure,
    );
  }
}
