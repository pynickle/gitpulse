import 'package:dio/dio.dart';

import 'native_capabilities.dart';

enum ConnectionProblem {
  invalidAddress,
  unreachable,
  serverUpgrade,
  clientUpgrade,
  noProviders,
  storageRead,
  storageWrite,
}

class ConnectionException implements Exception {
  const ConnectionException(this.problem);

  final ConnectionProblem problem;
}

class ConnectedBackend {
  const ConnectedBackend(this.address, this.capabilities);

  final Uri address;
  final NativeCapabilities capabilities;
}

class BackendService {
  BackendService(this._dio);

  final Dio _dio;

  Future<ConnectedBackend> connect(String address) async {
    final base = _parseAddress(address);
    final NativeCapabilities capabilities;
    try {
      final response = await _dio.get<Object?>(
        base.resolve('api/native/capabilities').toString(),
        options: Options(
          followRedirects: false,
          responseType: ResponseType.json,
        ),
      );
      final json = response.data;
      if (json is! Map<String, dynamic>) {
        throw const FormatException('Expected a capability response');
      }
      if (json['protocolVersion'] is! int) {
        throw const FormatException('Expected an integer protocol version');
      }
      if ((json['protocolVersion'] as int) > 1) {
        throw const ConnectionException(ConnectionProblem.clientUpgrade);
      }
      capabilities = NativeCapabilities.fromJson(json);
    } on DioException catch (error) {
      if ([404, 405, 426].contains(error.response?.statusCode)) {
        throw const ConnectionException(ConnectionProblem.serverUpgrade);
      }
      throw const ConnectionException(ConnectionProblem.unreachable);
    } on ConnectionException {
      rethrow;
    } catch (_) {
      throw const ConnectionException(ConnectionProblem.serverUpgrade);
    }

    if (capabilities.protocolVersion != 1 ||
        !capabilities.capabilities.contains('provider-discovery') ||
        !capabilities.capabilities.contains('release-timeline')) {
      throw const ConnectionException(ConnectionProblem.serverUpgrade);
    }
    final providers = capabilities.providers;
    final expectedMode = providers.personalMode
        ? 'personal'
        : providers.patEnabled && providers.oauthEnabled
        ? 'hybrid'
        : providers.oauthEnabled
        ? 'oauth-only'
        : 'pat-only';
    if (providers.mode != expectedMode ||
        (providers.personalMode &&
            (providers.patEnabled || providers.oauthEnabled))) {
      throw const ConnectionException(ConnectionProblem.serverUpgrade);
    }
    if (!providers.personalMode &&
        !providers.patEnabled &&
        !providers.oauthEnabled) {
      throw const ConnectionException(ConnectionProblem.noProviders);
    }
    if (!providers.personalMode &&
        !providers.patEnabled &&
        !capabilities.supportsNativeLogin) {
      throw const ConnectionException(ConnectionProblem.serverUpgrade);
    }
    return ConnectedBackend(base, capabilities);
  }

  Uri _parseAddress(String address) {
    final value = address.trim();
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !['https', 'http'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        value.contains(RegExp(r'[\s\\]'))) {
      throw const ConnectionException(ConnectionProblem.invalidAddress);
    }
    final normalized = uri.normalizePath();
    return normalized.replace(
      path: '${normalized.path.replaceFirst(RegExp(r'/+$'), '')}/',
    );
  }
}
