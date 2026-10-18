import 'package:json_annotation/json_annotation.dart';

part 'release_detail_dto.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: false,
  fieldRename: FieldRename.snake,
)
class ReleaseDetailDto {
  const ReleaseDetailDto({
    required this.id,
    required this.tagName,
    required this.htmlUrl,
    required this.assets,
    required this.draft,
    required this.prerelease,
    this.name,
    this.body,
    this.publishedAt,
    this.createdAt,
    this.author,
  });

  factory ReleaseDetailDto.fromJson(Map<String, dynamic> json) =>
      _$ReleaseDetailDtoFromJson(json);

  final int id;
  final String tagName;
  final String htmlUrl;
  final String? name;
  final String? body;
  final DateTime? publishedAt;
  final DateTime? createdAt;
  final bool draft;
  final bool prerelease;
  final ReleaseAuthorDto? author;
  final List<ReleaseAssetDto> assets;
}

@JsonSerializable(checked: true, createToJson: false)
class ReleaseAuthorDto {
  const ReleaseAuthorDto({required this.login});

  factory ReleaseAuthorDto.fromJson(Map<String, dynamic> json) =>
      _$ReleaseAuthorDtoFromJson(json);

  final String login;
}

@JsonSerializable(
  checked: true,
  createToJson: false,
  fieldRename: FieldRename.snake,
)
class ReleaseAssetDto {
  const ReleaseAssetDto({
    required this.id,
    required this.name,
    required this.size,
    required this.downloadCount,
    required this.browserDownloadUrl,
    this.label,
    this.contentType,
    this.updatedAt,
  });

  factory ReleaseAssetDto.fromJson(Map<String, dynamic> json) =>
      _$ReleaseAssetDtoFromJson(json);

  final int id;
  final String name;
  final String? label;
  final int size;
  final int downloadCount;
  final String browserDownloadUrl;
  final String? contentType;
  final DateTime? updatedAt;
}
