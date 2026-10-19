import 'package:json_annotation/json_annotation.dart';

part 'native_capabilities.g.dart';

@JsonSerializable(checked: true, explicitToJson: true)
class NativeCapabilities {
  const NativeCapabilities({
    required this.protocolVersion,
    required this.capabilities,
    required this.providers,
  });

  factory NativeCapabilities.fromJson(Map<String, dynamic> json) =>
      _$NativeCapabilitiesFromJson(json);

  final int protocolVersion;
  final List<String> capabilities;
  final SignInProviders providers;
  Map<String, dynamic> toJson() => _$NativeCapabilitiesToJson(this);

  bool get supportsNativeLogin =>
      !providers.personalMode &&
      providers.oauthEnabled &&
      capabilities.contains('native-login-handoff');
}

@JsonSerializable(checked: true)
class SignInProviders {
  const SignInProviders({
    required this.personalMode,
    required this.patEnabled,
    required this.oauthEnabled,
    required this.mode,
  });

  factory SignInProviders.fromJson(Map<String, dynamic> json) =>
      _$SignInProvidersFromJson(json);

  final bool personalMode;
  final bool patEnabled;
  final bool oauthEnabled;
  final String mode;
  Map<String, dynamic> toJson() => _$SignInProvidersToJson(this);
}
