// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'timeline_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserSettingsDto _$UserSettingsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserSettingsDto', json, ($checkedConvert) {
      final val = UserSettingsDto(
        followedRepositories: $checkedConvert(
          'followedRepositories',
          (v) => (v as List<dynamic>?)
              ?.map(
                (e) =>
                    FollowedRepositoryDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
      );
      return val;
    });

FollowedRepositoryDto _$FollowedRepositoryDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('FollowedRepositoryDto', json, ($checkedConvert) {
  final val = FollowedRepositoryDto(
    id: $checkedConvert('id', (v) => v as String),
    owner: $checkedConvert('owner', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
  );
  return val;
});

TimelineRoundDto _$TimelineRoundDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TimelineRoundDto', json, ($checkedConvert) {
  final val = TimelineRoundDto(
    pages: $checkedConvert(
      'pages',
      (v) => (v as Map<String, dynamic>?)?.map(
        (k, e) =>
            MapEntry(k, RepositoryPageDto.fromJson(e as Map<String, dynamic>)),
      ),
    ),
    refresh: $checkedConvert(
      'refresh',
      (v) => v == null
          ? null
          : TimelineRefreshDto.fromJson(v as Map<String, dynamic>),
    ),
    persistenceError: $checkedConvert('persistenceError', (v) => v as String?),
    unavailableIds: $checkedConvert(
      'unavailableIds',
      (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
    ),
    transientIds: $checkedConvert(
      'transientIds',
      (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
    ),
  );
  return val;
});

TimelineRefreshDto _$TimelineRefreshDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TimelineRefreshDto', json, ($checkedConvert) {
      final val = TimelineRefreshDto(
        previousBaseline: $checkedConvert(
          'previousBaseline',
          (v) => v as String?,
        ),
        startedAt: $checkedConvert('startedAt', (v) => v as String?),
      );
      return val;
    });

RepositoryPageDto _$RepositoryPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepositoryPageDto', json, ($checkedConvert) {
      final val = RepositoryPageDto(
        status: $checkedConvert('status', (v) => v as String),
        owner: $checkedConvert('owner', (v) => v as String?),
        name: $checkedConvert('name', (v) => v as String?),
        hasOlderReleases: $checkedConvert(
          'hasOlderReleases',
          (v) => v as bool?,
        ),
        endCursor: $checkedConvert('endCursor', (v) => v as String?),
        incomplete: $checkedConvert('incomplete', (v) => v as bool?),
        releases: $checkedConvert(
          'releases',
          (v) => (v as List<dynamic>?)
              ?.map((e) => ReleaseItemDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

ReleaseItemDto _$ReleaseItemDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReleaseItemDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['notesSearchText'],
    disallowNullValues: const ['notesSearchText'],
  );
  final val = ReleaseItemDto(
    id: $checkedConvert('id', (v) => (v as num).toInt()),
    tagName: $checkedConvert('tagName', (v) => v as String),
    notesSearchText: $checkedConvert('notesSearchText', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String?),
    description: $checkedConvert('description', (v) => v as String?),
    publishedAt: $checkedConvert('publishedAt', (v) => v as String?),
    isDraft: $checkedConvert('isDraft', (v) => v as bool? ?? false),
    isPrerelease: $checkedConvert('isPrerelease', (v) => v as bool? ?? false),
    assetCount: $checkedConvert('assetCount', (v) => (v as num?)?.toInt() ?? 0),
    htmlUrl: $checkedConvert('htmlUrl', (v) => v as String?),
  );
  return val;
});
