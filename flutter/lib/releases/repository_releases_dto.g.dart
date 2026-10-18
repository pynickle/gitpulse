// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'repository_releases_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepositoryReleasesPageDto _$RepositoryReleasesPageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepositoryReleasesPageDto', json, ($checkedConvert) {
  final val = RepositoryReleasesPageDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => RepositoryReleaseDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    pagination: $checkedConvert(
      'pagination',
      (v) =>
          RepositoryReleasesPaginationDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

RepositoryReleasesPaginationDto _$RepositoryReleasesPaginationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepositoryReleasesPaginationDto', json, ($checkedConvert) {
  final val = RepositoryReleasesPaginationDto(
    page: $checkedConvert('page', (v) => (v as num).toInt()),
    perPage: $checkedConvert('perPage', (v) => (v as num).toInt()),
    hasPrev: $checkedConvert('hasPrev', (v) => v as bool),
    hasNext: $checkedConvert('hasNext', (v) => v as bool),
  );
  return val;
});

RepositoryReleaseDto _$RepositoryReleaseDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate(
  'RepositoryReleaseDto',
  json,
  ($checkedConvert) {
    final val = RepositoryReleaseDto(
      id: $checkedConvert('id', (v) => (v as num).toInt()),
      tagName: $checkedConvert('tag_name', (v) => v as String),
      draft: $checkedConvert('draft', (v) => v as bool),
      prerelease: $checkedConvert('prerelease', (v) => v as bool),
      assetsCount: $checkedConvert('assets_count', (v) => (v as num).toInt()),
      downloadCount: $checkedConvert(
        'download_count',
        (v) => (v as num).toInt(),
      ),
      name: $checkedConvert('name', (v) => v as String?),
      publishedAt: $checkedConvert(
        'published_at',
        (v) => v == null ? null : DateTime.parse(v as String),
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'tagName': 'tag_name',
    'assetsCount': 'assets_count',
    'downloadCount': 'download_count',
    'publishedAt': 'published_at',
  },
);
