// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'repository_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepositoryDto _$RepositoryDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'RepositoryDto',
      json,
      ($checkedConvert) {
        final val = RepositoryDto(
          name: $checkedConvert('name', (v) => v as String),
          nodeId: $checkedConvert('node_id', (v) => v as String),
          owner: $checkedConvert(
            'owner',
            (v) => RepositoryOwnerDto.fromJson(v as Map<String, dynamic>),
          ),
          defaultBranch: $checkedConvert('default_branch', (v) => v as String),
          stargazersCount: $checkedConvert(
            'stargazers_count',
            (v) => (v as num).toInt(),
          ),
          forksCount: $checkedConvert('forks_count', (v) => (v as num).toInt()),
          subscribersCount: $checkedConvert(
            'subscribers_count',
            (v) => (v as num?)?.toInt(),
          ),
          description: $checkedConvert('description', (v) => v as String?),
          language: $checkedConvert('language', (v) => v as String?),
        );
        return val;
      },
      fieldKeyMap: const {
        'nodeId': 'node_id',
        'defaultBranch': 'default_branch',
        'stargazersCount': 'stargazers_count',
        'forksCount': 'forks_count',
        'subscribersCount': 'subscribers_count',
      },
    );

RepositoryOwnerDto _$RepositoryOwnerDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepositoryOwnerDto', json, ($checkedConvert) {
      final val = RepositoryOwnerDto(
        login: $checkedConvert('login', (v) => v as String),
        avatarUrl: $checkedConvert('avatar_url', (v) => v as String?),
      );
      return val;
    }, fieldKeyMap: const {'avatarUrl': 'avatar_url'});

RepositoryReadmeDto _$RepositoryReadmeDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RepositoryReadmeDto', json, ($checkedConvert) {
      final val = RepositoryReadmeDto(
        content: $checkedConvert('content', (v) => v as String?),
        path: $checkedConvert('path', (v) => v as String?),
      );
      return val;
    });
