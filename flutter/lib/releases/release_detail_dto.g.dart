// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'release_detail_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReleaseDetailDto _$ReleaseDetailDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'ReleaseDetailDto',
      json,
      ($checkedConvert) {
        final val = ReleaseDetailDto(
          id: $checkedConvert('id', (v) => (v as num).toInt()),
          tagName: $checkedConvert('tag_name', (v) => v as String),
          htmlUrl: $checkedConvert('html_url', (v) => v as String),
          assets: $checkedConvert(
            'assets',
            (v) => (v as List<dynamic>)
                .map((e) => ReleaseAssetDto.fromJson(e as Map<String, dynamic>))
                .toList(),
          ),
          draft: $checkedConvert('draft', (v) => v as bool),
          prerelease: $checkedConvert('prerelease', (v) => v as bool),
          name: $checkedConvert('name', (v) => v as String?),
          body: $checkedConvert('body', (v) => v as String?),
          publishedAt: $checkedConvert(
            'published_at',
            (v) => v == null ? null : DateTime.parse(v as String),
          ),
          createdAt: $checkedConvert(
            'created_at',
            (v) => v == null ? null : DateTime.parse(v as String),
          ),
          author: $checkedConvert(
            'author',
            (v) => v == null
                ? null
                : ReleaseAuthorDto.fromJson(v as Map<String, dynamic>),
          ),
        );
        return val;
      },
      fieldKeyMap: const {
        'tagName': 'tag_name',
        'htmlUrl': 'html_url',
        'publishedAt': 'published_at',
        'createdAt': 'created_at',
      },
    );

ReleaseAuthorDto _$ReleaseAuthorDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReleaseAuthorDto', json, ($checkedConvert) {
      final val = ReleaseAuthorDto(
        login: $checkedConvert('login', (v) => v as String),
      );
      return val;
    });

ReleaseAssetDto _$ReleaseAssetDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'ReleaseAssetDto',
      json,
      ($checkedConvert) {
        final val = ReleaseAssetDto(
          id: $checkedConvert('id', (v) => (v as num).toInt()),
          name: $checkedConvert('name', (v) => v as String),
          size: $checkedConvert('size', (v) => (v as num).toInt()),
          downloadCount: $checkedConvert(
            'download_count',
            (v) => (v as num).toInt(),
          ),
          browserDownloadUrl: $checkedConvert(
            'browser_download_url',
            (v) => v as String,
          ),
          label: $checkedConvert('label', (v) => v as String?),
          contentType: $checkedConvert('content_type', (v) => v as String?),
          updatedAt: $checkedConvert(
            'updated_at',
            (v) => v == null ? null : DateTime.parse(v as String),
          ),
        );
        return val;
      },
      fieldKeyMap: const {
        'downloadCount': 'download_count',
        'browserDownloadUrl': 'browser_download_url',
        'contentType': 'content_type',
        'updatedAt': 'updated_at',
      },
    );
