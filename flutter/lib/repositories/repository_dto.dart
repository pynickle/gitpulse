import 'package:json_annotation/json_annotation.dart';

part 'repository_dto.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: false,
  fieldRename: FieldRename.snake,
)
class RepositoryDto {
  const RepositoryDto({
    required this.name,
    required this.nodeId,
    required this.owner,
    required this.defaultBranch,
    required this.stargazersCount,
    required this.forksCount,
    this.subscribersCount,
    this.description,
    this.language,
  });

  factory RepositoryDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryDtoFromJson(json);

  final String name;

  /// GitHub's own identifier for this repository.
  ///
  /// It is what a Release Follow stores, so the page can tell whether this
  /// repository is already followed without a second identity of its own.
  final String nodeId;

  final RepositoryOwnerDto owner;
  final String defaultBranch;
  final int stargazersCount;
  final int forksCount;
  final int? subscribersCount;
  final String? description;
  final String? language;
  String get fullName => '${owner.login}/$name';
}

@JsonSerializable(
  checked: true,
  createToJson: false,
  fieldRename: FieldRename.snake,
)
class RepositoryOwnerDto {
  const RepositoryOwnerDto({required this.login, this.avatarUrl});
  factory RepositoryOwnerDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryOwnerDtoFromJson(json);
  final String login;

  /// The owner's GitHub avatar, when the payload carries one.
  final String? avatarUrl;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryReadmeDto {
  const RepositoryReadmeDto({this.content, this.path});
  factory RepositoryReadmeDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryReadmeDtoFromJson(json);
  final String? content;
  final String? path;
}
