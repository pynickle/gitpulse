import 'package:json_annotation/json_annotation.dart';

import '../timeline/timeline_models.dart';

part 'release_follows_dto.g.dart';

@JsonSerializable(checked: true, createToJson: false)
class FollowMetadataResponseDto {
  const FollowMetadataResponseDto({required this.repositories});

  factory FollowMetadataResponseDto.fromJson(Map<String, dynamic> json) =>
      _$FollowMetadataResponseDtoFromJson(json);

  final Map<String, FollowMetadataDto> repositories;
}

@JsonSerializable(checked: true, createToJson: false)
class FollowMetadataDto {
  const FollowMetadataDto({required this.status, this.owner, this.name});

  factory FollowMetadataDto.fromJson(Map<String, dynamic> json) =>
      _$FollowMetadataDtoFromJson(json);

  final RepositoryPageStatus status;
  final String? owner;
  final String? name;
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
  const RepositorySearchPaginationDto({this.hasNext = false});

  factory RepositorySearchPaginationDto.fromJson(Map<String, dynamic> json) =>
      _$RepositorySearchPaginationDtoFromJson(json);

  final bool hasNext;
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

  TimelineRepository get repository =>
      TimelineRepository(id: nodeId, owner: owner.login, name: name);
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryOwnerDto {
  const RepositoryOwnerDto({required this.login});

  factory RepositoryOwnerDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryOwnerDtoFromJson(json);

  final String login;
}
