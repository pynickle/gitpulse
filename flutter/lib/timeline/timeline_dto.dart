import 'package:json_annotation/json_annotation.dart';

import 'timeline_models.dart';
import '../repositories/repository_models.dart';

part 'timeline_dto.g.dart';

/// One `ReleaseTimelinePage` response: the per-repository pages of this round,
/// the refresh bookmark, and any reported failures.
@JsonSerializable(checked: true, createToJson: false)
class TimelineRoundDto {
  const TimelineRoundDto({
    this.pages,
    this.refresh,
    this.persistenceError,
    this.unavailableIds,
    this.transientIds,
  });

  factory TimelineRoundDto.fromJson(Map<String, dynamic> json) =>
      _$TimelineRoundDtoFromJson(json);

  final Map<String, RepositoryPageDto>? pages;
  final TimelineRefreshDto? refresh;
  final String? persistenceError;
  final List<String>? unavailableIds;
  final List<String>? transientIds;

  Map<String, RepositoryPage> toDomainPages() => {
    for (final entry in (pages ?? const <String, RepositoryPageDto>{}).entries)
      entry.key: entry.value.toDomain(),
  };
}

/// The refresh bookmark: the previous Timeline Refresh Baseline captured before
/// the round, and the server time that becomes the next baseline.
@JsonSerializable(checked: true, createToJson: false)
class TimelineRefreshDto {
  const TimelineRefreshDto({this.previousBaseline, this.startedAt});

  factory TimelineRefreshDto.fromJson(Map<String, dynamic> json) =>
      _$TimelineRefreshDtoFromJson(json);

  final String? previousBaseline;
  final String? startedAt;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryPageDto {
  const RepositoryPageDto({
    required this.status,
    this.owner,
    this.name,
    this.hasOlderReleases,
    this.endCursor,
    this.incomplete,
    this.releases,
  });

  factory RepositoryPageDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryPageDtoFromJson(json);

  final String status;
  final String? owner;
  final String? name;
  final bool? hasOlderReleases;
  final String? endCursor;
  final bool? incomplete;
  final List<ReleaseItemDto>? releases;

  RepositoryPage toDomain() => RepositoryPage(
    status: switch (status) {
      'available' => RepositoryQueryStatus.available,
      'unavailable' => RepositoryQueryStatus.unavailable,
      _ => RepositoryQueryStatus.transient,
    },
    owner: owner ?? '',
    name: name ?? '',
    hasOlderReleases: hasOlderReleases ?? false,
    endCursor: endCursor,
    incomplete: incomplete ?? false,
    releases: [
      for (final item in releases ?? const <ReleaseItemDto>[]) item.toDomain(),
    ],
  );
}

@JsonSerializable(checked: true, createToJson: false)
class ReleaseItemDto {
  const ReleaseItemDto({
    required this.id,
    required this.tagName,
    required this.notesSearchText,
    this.name,
    this.description,
    this.publishedAt,
    this.isDraft = false,
    this.isPrerelease = false,
    this.assetCount = 0,
    this.htmlUrl,
  });

  factory ReleaseItemDto.fromJson(Map<String, dynamic> json) =>
      _$ReleaseItemDtoFromJson(json);

  final int id;
  final String tagName;
  final String? name;

  /// The complete release notes, kept for the release surfaces.
  final String? description;
  @JsonKey(required: true, disallowNullValue: true)
  final String notesSearchText;
  final String? publishedAt;
  final bool isDraft;
  final bool isPrerelease;
  final int assetCount;
  final String? htmlUrl;

  ReleaseItem toDomain() => ReleaseItem(
    id: id,
    tagName: tagName,
    name: name,
    description: description,
    notesSearchText: notesSearchText,
    publishedAt: publishedAt == null
        ? null
        : DateTime.tryParse(publishedAt!)?.toUtc(),
    isDraft: isDraft,
    isPrerelease: isPrerelease,
    assetCount: assetCount,
    htmlUrl: htmlUrl,
  );
}
