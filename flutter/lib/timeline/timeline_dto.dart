import 'package:json_annotation/json_annotation.dart';

import 'timeline_models.dart';

part 'timeline_dto.g.dart';

/// The typed view of the account settings the Timeline needs. Unrelated
/// preferences stay untouched and unread.
@JsonSerializable(checked: true, createToJson: false)
class UserSettingsDto {
  const UserSettingsDto({this.followedRepositories, this.releaseTimeline});

  factory UserSettingsDto.fromJson(Map<String, dynamic> json) =>
      _$UserSettingsDtoFromJson(json);

  final List<FollowedRepositoryDto>? followedRepositories;
  final TimelinePreferencesDto? releaseTimeline;
}

@JsonSerializable(checked: true, createToJson: false)
class TimelinePreferencesDto {
  const TimelinePreferencesDto({this.retentionDays});

  factory TimelinePreferencesDto.fromJson(Map<String, dynamic> json) =>
      _$TimelinePreferencesDtoFromJson(json);

  @JsonKey(fromJson: validatedRetentionDays)
  final int? retentionDays;
}

int? validatedRetentionDays(Object? value) =>
    value is int && value >= 1 && value <= 90 ? value : null;

/// A Followed Repository as the account stores it.
@JsonSerializable(checked: true, createToJson: false)
class FollowedRepositoryDto {
  const FollowedRepositoryDto({
    required this.id,
    required this.owner,
    required this.name,
  });

  factory FollowedRepositoryDto.fromJson(Map<String, dynamic> json) =>
      _$FollowedRepositoryDtoFromJson(json);

  final String id;
  final String owner;
  final String name;

  TimelineRepository toDomain() =>
      TimelineRepository(id: id, owner: owner, name: name);
}

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
      'available' => RepositoryPageStatus.available,
      'unavailable' => RepositoryPageStatus.unavailable,
      _ => RepositoryPageStatus.transient,
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
    publishedAt: publishedAt == null
        ? null
        : DateTime.tryParse(publishedAt!)?.toUtc(),
    isDraft: isDraft,
    isPrerelease: isPrerelease,
    assetCount: assetCount,
    htmlUrl: htmlUrl,
  );
}

List<TimelineRepository> mapFollowedRepositories(UserSettingsDto settings) => [
  for (final follow
      in settings.followedRepositories ?? const <FollowedRepositoryDto>[])
    follow.toDomain(),
];
