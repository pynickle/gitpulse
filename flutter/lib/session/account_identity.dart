import 'dart:convert';

/// A GitHub account within one canonical GitPulse backend base URL.
final class AccountIdentity {
  const AccountIdentity({required this.backend, required this.githubId});

  final Uri backend;
  final String githubId;

  /// The same identity encoded for local persistence, including the base path.
  String get scope => jsonEncode([backend.toString(), githubId]);

  @override
  bool operator ==(Object other) =>
      other is AccountIdentity &&
      backend == other.backend &&
      githubId == other.githubId;

  @override
  int get hashCode => Object.hash(backend, githubId);
}
