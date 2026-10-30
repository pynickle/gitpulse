import 'package:json_annotation/json_annotation.dart';

import '../repositories/repository_models.dart';

part 'release_follows_dto.g.dart';

/// The Release Follows collection within the account settings response.
@JsonSerializable(checked: true, createToJson: false)
class FollowCollectionDto {
  const FollowCollectionDto({required this.followedRepositories});

  factory FollowCollectionDto.fromJson(Map<String, dynamic> json) =>
      _$FollowCollectionDtoFromJson(json);

  final List<FollowedRepositoryDto> followedRepositories;

  List<RepositoryReference> toDomain() => [
    for (final follow in followedRepositories) follow.toDomain(),
  ];
}

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

  RepositoryReference toDomain() =>
      RepositoryReference(id: id, owner: owner, name: name);
}

@JsonSerializable(checked: true, createToJson: false)
class FollowMetadataResponseDto {
  const FollowMetadataResponseDto({required this.repositories});

  factory FollowMetadataResponseDto.fromJson(Map<String, dynamic> json) =>
      _$FollowMetadataResponseDtoFromJson(json);

  final Map<String, FollowMetadataDto> repositories;
}

@JsonSerializable(checked: true, createToJson: false)
class FollowMetadataDto {
  const FollowMetadataDto({
    required this.status,
    this.owner,
    this.name,
    this.description,
    this.primaryLanguage,
    this.starCount,
  });

  factory FollowMetadataDto.fromJson(Map<String, dynamic> json) =>
      _$FollowMetadataDtoFromJson(json);

  final RepositoryQueryStatus status;
  final String? owner;
  final String? name;
  final String? description;
  final String? primaryLanguage;
  final int? starCount;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositorySearchDto {
  const RepositorySearchDto({required this.items, this.pagination});

  factory RepositorySearchDto.fromJson(Map<String, dynamic> json) =>
      _$RepositorySearchDtoFromJson(json);

  final List<RepositoryCandidateDto> items;
  final RepositorySearchPaginationDto? pagination;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositorySearchPaginationDto {
  const RepositorySearchPaginationDto({
    this.page = 1,
    this.perPage = 30,
    this.hasPrev = false,
    this.hasNext = false,
    this.totalCount,
    this.totalPages,
  });

  factory RepositorySearchPaginationDto.fromJson(Map<String, dynamic> json) =>
      _$RepositorySearchPaginationDtoFromJson(json);

  final int page;
  final int perPage;
  final bool hasPrev;
  final bool hasNext;
  final int? totalCount;
  final int? totalPages;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryCandidateDto {
  const RepositoryCandidateDto({
    required this.nodeId,
    required this.owner,
    required this.name,
    this.description,
    this.language,
    this.stargazersCount = 0,
  });

  factory RepositoryCandidateDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryCandidateDtoFromJson(json);

  @JsonKey(name: 'node_id')
  final String nodeId;
  final RepositoryOwnerDto owner;
  final String name;
  final String? description;
  final String? language;
  @JsonKey(name: 'stargazers_count')
  final int stargazersCount;

  RepositoryReference get repository =>
      RepositoryReference(id: nodeId, owner: owner.login, name: name);
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryOwnerDto {
  const RepositoryOwnerDto({required this.login});

  factory RepositoryOwnerDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryOwnerDtoFromJson(json);

  final String login;
}
