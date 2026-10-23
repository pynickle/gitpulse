// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'release_follows_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FollowMetadataResponseDto _$FollowMetadataResponseDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('FollowMetadataResponseDto', json, ($checkedConvert) {
  final val = FollowMetadataResponseDto(
    repositories: $checkedConvert(
      'repositories',
      (v) => (v as Map<String, dynamic>).map(
        (k, e) =>
            MapEntry(k, FollowMetadataDto.fromJson(e as Map<String, dynamic>)),
      ),
    ),
  );
  return val;
});

FollowMetadataDto _$FollowMetadataDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FollowMetadataDto', json, ($checkedConvert) {
      final val = FollowMetadataDto(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$RepositoryPageStatusEnumMap, v),
        ),
        owner: $checkedConvert('owner', (v) => v as String?),
        name: $checkedConvert('name', (v) => v as String?),
      );
      return val;
    });

const _$RepositoryPageStatusEnumMap = {
  RepositoryPageStatus.available: 'available',
  RepositoryPageStatus.unavailable: 'unavailable',
  RepositoryPageStatus.transient: 'transient',
};

RepositorySearchDto _$RepositorySearchDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepositorySearchDto', json, ($checkedConvert) {
      final val = RepositorySearchDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    RepositoryCandidateDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        pagination: $checkedConvert(
          'pagination',
          (v) => v == null
              ? null
              : RepositorySearchPaginationDto.fromJson(
                  v as Map<String, dynamic>,
                ),
        ),
      );
      return val;
    });

RepositorySearchPaginationDto _$RepositorySearchPaginationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepositorySearchPaginationDto', json, ($checkedConvert) {
  final val = RepositorySearchPaginationDto(
    hasNext: $checkedConvert('hasNext', (v) => v as bool? ?? false),
  );
  return val;
});

RepositoryCandidateDto _$RepositoryCandidateDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate(
  'RepositoryCandidateDto',
  json,
  ($checkedConvert) {
    final val = RepositoryCandidateDto(
      nodeId: $checkedConvert('node_id', (v) => v as String),
      owner: $checkedConvert(
        'owner',
        (v) => RepositoryOwnerDto.fromJson(v as Map<String, dynamic>),
      ),
      name: $checkedConvert('name', (v) => v as String),
      description: $checkedConvert('description', (v) => v as String?),
      language: $checkedConvert('language', (v) => v as String?),
      stargazersCount: $checkedConvert(
        'stargazers_count',
        (v) => (v as num?)?.toInt() ?? 0,
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'nodeId': 'node_id',
    'stargazersCount': 'stargazers_count',
  },
);

RepositoryOwnerDto _$RepositoryOwnerDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepositoryOwnerDto', json, ($checkedConvert) {
      final val = RepositoryOwnerDto(
        login: $checkedConvert('login', (v) => v as String),
      );
      return val;
    });
