// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'native_capabilities.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NativeCapabilities _$NativeCapabilitiesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NativeCapabilities', json, ($checkedConvert) {
      final val = NativeCapabilities(
        protocolVersion: $checkedConvert(
          'protocolVersion',
          (v) => (v as num).toInt(),
        ),
        capabilities: $checkedConvert(
          'capabilities',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        providers: $checkedConvert(
          'providers',
          (v) => SignInProviders.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

SignInProviders _$SignInProvidersFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SignInProviders', json, ($checkedConvert) {
      final val = SignInProviders(
        personalMode: $checkedConvert('personalMode', (v) => v as bool),
        patEnabled: $checkedConvert('patEnabled', (v) => v as bool),
        oauthEnabled: $checkedConvert('oauthEnabled', (v) => v as bool),
        mode: $checkedConvert('mode', (v) => v as String),
      );
      return val;
    });
