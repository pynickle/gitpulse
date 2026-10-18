import 'package:json_annotation/json_annotation.dart';

part 'repository_releases_dto.g.dart';

@JsonSerializable(checked: true, createToJson: false)
class RepositoryReleasesPageDto {
  const RepositoryReleasesPageDto({
    required this.items,
    required this.pagination,
  });

  factory RepositoryReleasesPageDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryReleasesPageDtoFromJson(json);

  final List<RepositoryReleaseDto> items;
  final RepositoryReleasesPaginationDto pagination;
}

@JsonSerializable(checked: true, createToJson: false)
class RepositoryReleasesPaginationDto {
  const RepositoryReleasesPaginationDto({
    required this.page,
    required this.perPage,
    required this.hasPrev,
    required this.hasNext,
  });

  factory RepositoryReleasesPaginationDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryReleasesPaginationDtoFromJson(json);

  final int page;
  final int perPage;
  final bool hasPrev;
  final bool hasNext;
}

@JsonSerializable(
  checked: true,
  createToJson: false,
  fieldRename: FieldRename.snake,
)
class RepositoryReleaseDto {
  const RepositoryReleaseDto({
    required this.id,
    required this.tagName,
    required this.draft,
    required this.prerelease,
    required this.assetsCount,
    required this.downloadCount,
    this.name,
    this.publishedAt,
  });

  factory RepositoryReleaseDto.fromJson(Map<String, dynamic> json) =>
      _$RepositoryReleaseDtoFromJson(json);

  final int id;
  final String tagName;
  final String? name;
  final DateTime? publishedAt;
  final bool draft;
  final bool prerelease;
  final int assetsCount;
  final int downloadCount;
}
