/// A GitHub repository identified by its stable node ID across renames.
class RepositoryReference {
  const RepositoryReference({
    required this.id,
    required this.owner,
    required this.name,
  });

  final String id;
  final String owner;
  final String name;

  String get fullName => '$owner/$name';

  @override
  bool operator ==(Object other) =>
      other is RepositoryReference && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'RepositoryReference($id, $fullName)';
}

/// The result of one repository query, rather than a permanent repository state.
enum RepositoryQueryStatus { available, unavailable, transient }
