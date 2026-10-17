import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'lifetime_cookie_jar.dart';
import 'secure_cookie_storage.dart';
import 'secure_storage.dart';

const csrfCookieName = 'gitpulse_csrf';
const csrfHeaderName = 'x-csrf-token';
const sessionCookieName = 'nuxt-session';

const _mutatingMethods = {'POST', 'PUT', 'PATCH', 'DELETE'};

enum BackendProblem {
  authenticationRejected,
  invalidCredentials,
  network,
  rateLimited,
  repositoryPermission,
  csrfRejected,
  providerUnavailable,
  unavailable,
  storage,
  cancelled,
}

class BackendResult {
  const BackendResult({
    this.statusCode,
    this.data,
    this.problem,
    this.cancelled = false,
  });

  final int? statusCode;
  final Object? data;
  final BackendProblem? problem;
  final bool cancelled;
}

class AuthenticatedIdentity {
  const AuthenticatedIdentity({
    required this.backend,
    required this.login,
    required this.name,
    required this.avatarUrl,
  });

  final Uri backend;
  final String login;
  final String name;
  final String avatarUrl;

  bool sameAccount(AuthenticatedIdentity other) =>
      login == other.login && backend == other.backend;
}

final cookieJarProvider = Provider<CookieJar>(
  (ref) => LifetimeCookieJar(
    storage: SecureCookieStorage(ref.watch(secureStorageProvider)),
  ),
);

Dio createGitPulseDio(CookieJar jar) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      followRedirects: false,
    ),
  );
  dio.interceptors
    ..add(CsrfInterceptor(jar))
    ..add(CookieManager(jar));
  return dio;
}

class CsrfInterceptor extends Interceptor {
  CsrfInterceptor(this._jar);

  final CookieJar _jar;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final method = options.method.toUpperCase();
    final path = options.uri.path;
    final mutating =
        _mutatingMethods.contains(method) &&
        (path.contains('/api/') || path.contains('/auth/'));
    if (!mutating) {
      handler.next(options);
      return;
    }
    try {
      final cookies = await _jar.loadForRequest(options.uri);
      for (final cookie in cookies) {
        if (cookie.name == csrfCookieName && cookie.value.isNotEmpty) {
          options.headers[csrfHeaderName] = cookie.value;
          break;
        }
      }
      handler.next(options);
    } catch (error, stackTrace) {
      handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.unknown,
          error: CookieManagerLoadException(
            error: error,
            stackTrace: stackTrace,
          ),
          stackTrace: stackTrace,
        ),
      );
    }
  }
}

class RequestScope {
  int generation = 0;
  CancelToken token = CancelToken();

  void invalidate() {
    generation += 1;
    if (!token.isCancelled) token.cancel('identity cleared');
    token = CancelToken();
  }
}

bool isSignInPath(String path) =>
    path.endsWith('/auth/unlock') || path.endsWith('/auth/pat');

String? readStatusMessage(Object? data) {
  if (data is! Map) return null;
  final statusMessage = data['statusMessage'];
  if (statusMessage is String && statusMessage.isNotEmpty) return statusMessage;
  final message = data['message'];
  if (message is String && message.isNotEmpty) return message;
  return null;
}

AuthenticatedIdentity? readSessionUser(Object? data, Uri backend) {
  if (data is! Map) return null;
  final user = data['user'];
  if (user is! Map) return null;
  final login = user['login'];
  if (login is! String || login.trim().isEmpty) return null;
  final name = user['name'];
  final avatar = user['avatar_url'];
  final normalizedLogin = login.trim();
  return AuthenticatedIdentity(
    backend: backend,
    login: normalizedLogin,
    name: name is String && name.trim().isNotEmpty
        ? name.trim()
        : normalizedLogin,
    avatarUrl: avatar is String ? avatar : '',
  );
}

BackendProblem? classifyBackendFailure({
  required int? statusCode,
  required String path,
  required String? statusMessage,
  required bool network,
  required bool cancelled,
  required bool storage,
}) {
  if (cancelled) return BackendProblem.cancelled;
  if (storage) return BackendProblem.storage;
  if (network || statusCode == null) return BackendProblem.network;
  if (statusCode < 400) return null;
  final message = (statusMessage ?? '').toLowerCase();
  final signIn = isSignInPath(path);
  if (statusCode == 429 || message.contains('rate limit')) {
    return BackendProblem.rateLimited;
  }
  if (statusCode == 403 && message.contains('csrf')) {
    return BackendProblem.csrfRejected;
  }
  if (signIn && (statusCode == 401 || statusCode == 400)) {
    return BackendProblem.invalidCredentials;
  }
  if (statusCode == 401) return BackendProblem.authenticationRejected;
  if (signIn && (statusCode == 403 || statusCode == 503)) {
    return BackendProblem.providerUnavailable;
  }
  if (statusCode == 403) return BackendProblem.repositoryPermission;
  if (statusCode >= 500) return BackendProblem.unavailable;
  return BackendProblem.unavailable;
}

BackendResult resultFromResponse(Response<Object?> response) {
  final path = response.requestOptions.uri.path;
  final statusCode = response.statusCode;
  final problem = classifyBackendFailure(
    statusCode: statusCode,
    path: path,
    statusMessage: readStatusMessage(response.data),
    network: false,
    cancelled: false,
    storage: false,
  );
  return BackendResult(
    statusCode: statusCode,
    data: response.data,
    problem: problem,
  );
}

BackendResult resultFromDio(DioException error) {
  final path = error.requestOptions.uri.path;
  final response = error.response;
  final storage =
      error.error is CookieManagerLoadException ||
      error.error is CookieManagerSaveException;
  final cancelled = CancelToken.isCancel(error);
  final network =
      !storage &&
      !cancelled &&
      response == null &&
      error.type != DioExceptionType.badResponse;
  return BackendResult(
    statusCode: response?.statusCode,
    data: response?.data,
    cancelled: cancelled,
    problem: classifyBackendFailure(
      statusCode: response?.statusCode,
      path: path,
      statusMessage: readStatusMessage(response?.data),
      network: network,
      cancelled: cancelled,
      storage: storage,
    ),
  );
}
