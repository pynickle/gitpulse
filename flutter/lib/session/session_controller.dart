import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import 'gitpulse_http.dart';
import 'secure_storage.dart';

const _identityKey = 'authenticated_identity';

enum SessionPhase { signedOut, signedIn, rejected }

enum SignInFailure {
  invalidCredentials,
  network,
  rateLimited,
  providerUnavailable,
  storage,
  unavailable,
}

enum IdentityClearReason { signOut, backendChange, accountSwitch }

sealed class IdentityTransition {
  const IdentityTransition();
}

class IdentityCleared extends IdentityTransition {
  const IdentityCleared(this.previous, this.reason);

  final AuthenticatedIdentity? previous;
  final IdentityClearReason reason;
}

class IdentityRestored extends IdentityTransition {
  const IdentityRestored(this.identity);

  final AuthenticatedIdentity identity;
}

class SessionRejected extends IdentityTransition {
  const SessionRejected(this.identity);

  final AuthenticatedIdentity identity;
}

class SessionState {
  const SessionState({
    this.phase = SessionPhase.signedOut,
    this.identity,
    this.busy = false,
    this.failure,
    this.offline = false,
  });

  final SessionPhase phase;
  final AuthenticatedIdentity? identity;
  final bool busy;
  final SignInFailure? failure;
  final bool offline;

  SessionState copyWith({
    SessionPhase? phase,
    AuthenticatedIdentity? identity,
    bool clearIdentity = false,
    bool? busy,
    SignInFailure? failure,
    bool clearFailure = false,
    bool? offline,
  }) {
    return SessionState(
      phase: phase ?? this.phase,
      identity: clearIdentity ? null : identity ?? this.identity,
      busy: busy ?? this.busy,
      failure: clearFailure ? null : failure ?? this.failure,
      offline: offline ?? this.offline,
    );
  }
}

final sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

class SessionController extends Notifier<SessionState> {
  final _scope = RequestScope();
  // Sync so listeners observe the clear before signed-in state moves on.
  final _events = StreamController<IdentityTransition>.broadcast(sync: true);
  final _log = <IdentityTransition>[];
  final _pendingEvents = <IdentityTransition>[];
  bool _emitting = false;
  int _restoreSerial = 0;
  bool _clearing = false;
  Future<void> _identityTask = Future.value();

  Stream<IdentityTransition> get transitions => _events.stream;

  List<IdentityTransition> get transitionLog => List.unmodifiable(_log);

  @override
  SessionState build() {
    ref.onDispose(() {
      _scope.invalidate();
      _events.close();
    });
    ref.listen(connectionControllerProvider, (previous, next) {
      final backend = next.value?.backend;
      if (backend == null) return;
      if (previous?.value?.backend?.address == backend.address) return;
      _restore(backend.address);
    });
    final backend = ref.read(connectionControllerProvider).value?.backend;
    if (backend != null) {
      Future<void>.microtask(() => _restore(backend.address));
    }
    return const SessionState();
  }

  Future<void> unlock(String password) {
    return _signIn(
      path: 'auth/unlock',
      body: {'password': password, 'remember': false},
    );
  }

  Future<void> signInWithToken(String token) {
    return _signIn(path: 'auth/pat', body: {'token': token});
  }

  /// Clears the signed-in identity before logout finishes so in-flight work
  /// cannot commit against the previous account.
  Future<void> signOut() async {
    await _clearIdentity(IdentityClearReason.signOut);
  }

  Future<void> switchAccount() =>
      _clearIdentity(IdentityClearReason.accountSwitch);

  /// Backend changes drop the previous identity before the connection screen
  /// returns, including when the server cannot be reached.
  Future<void> leaveBackend() async {
    await _clearIdentity(IdentityClearReason.backendChange);
  }

  Future<void> _clearIdentity(IdentityClearReason reason) async {
    if (_clearing) return;
    _clearing = true;
    final backend = ref.read(connectionControllerProvider).value?.backend;
    _beginClear(IdentityCleared(state.identity, reason));
    var storageFailed = false;
    try {
      try {
        await _queueIdentityWrite(_deleteIdentity);
      } catch (_) {
        storageFailed = true;
      }
      if (!ref.mounted) return;
      if (backend != null) {
        final result = await _send(
          method: 'POST',
          backend: backend.address,
          path: 'auth/logout',
        );
        storageFailed |= result.problem == BackendProblem.storage;
        if (!ref.mounted) return;
        try {
          await ref.read(cookieJarProvider).delete(backend.address, true);
        } catch (_) {
          storageFailed = true;
        }
      }
      if (!ref.mounted) return;
      state = SessionState(
        failure: storageFailed ? SignInFailure.storage : null,
      );
      if (!storageFailed && reason == IdentityClearReason.backendChange) {
        ref.read(connectionControllerProvider.notifier).changeBackend();
      }
    } finally {
      _clearing = false;
    }
  }

  Future<BackendResult> request({
    required String method,
    required String path,
    Object? body,
  }) async {
    if (state.phase != SessionPhase.signedIn) {
      return const BackendResult(
        problem: BackendProblem.authenticationRejected,
      );
    }
    if (state.busy) {
      return const BackendResult(
        cancelled: true,
        problem: BackendProblem.cancelled,
      );
    }
    final backend = ref.read(connectionControllerProvider).value?.backend;
    if (backend == null) {
      return const BackendResult(problem: BackendProblem.network);
    }
    final result = await _send(
      method: method,
      backend: backend.address,
      path: path,
      body: body,
    );
    if (!ref.mounted || result.cancelled) return result;
    final identity = state.identity;
    if (result.problem == BackendProblem.authenticationRejected &&
        identity != null &&
        state.phase == SessionPhase.signedIn) {
      state = SessionState(phase: SessionPhase.rejected, identity: identity);
      _scope.invalidate();
      _emit(SessionRejected(identity));
    } else if (result.problem == BackendProblem.network &&
        state.phase == SessionPhase.signedIn) {
      state = state.copyWith(offline: true);
    } else if (result.problem == null && state.offline) {
      state = state.copyWith(offline: false);
    }
    return result;
  }

  Future<void> _signIn({required String path, required Object body}) async {
    final backend = ref.read(connectionControllerProvider).value?.backend;
    if (backend == null || state.busy || _clearing) return;
    final previous = state.identity;
    final phase = state.phase;
    final serial = ++_restoreSerial;
    final generation = _scope.generation;
    state = state.copyWith(busy: true, clearFailure: true, offline: false);
    final result = await _send(
      method: 'POST',
      backend: backend.address,
      path: path,
      body: body,
    );
    if (!ref.mounted ||
        serial != _restoreSerial ||
        generation != _scope.generation ||
        result.cancelled) {
      return;
    }
    final user = readSessionUser(result.data, backend.address);
    if (result.problem == null && user != null) {
      final switched =
          previous != null &&
          (previous.login != user.login || previous.backend != user.backend);
      if (switched) {
        // Tell listeners before the new identity is visible.
        _emit(IdentityCleared(previous, IdentityClearReason.accountSwitch));
        _scope.invalidate();
      } else if (previous != null && previous.sameAccount(user)) {
        _emit(IdentityRestored(user));
      }
      if (!ref.mounted || serial != _restoreSerial) return;
      final stored = await _saveIdentity(user);
      if (!ref.mounted || serial != _restoreSerial) return;
      state = SessionState(
        phase: SessionPhase.signedIn,
        identity: user,
        failure: stored ? null : SignInFailure.storage,
      );
      return;
    }
    state = SessionState(
      phase: phase,
      identity: previous,
      failure: _failureFor(result.problem),
    );
  }

  Future<void> _restore(Uri backend) async {
    if (_clearing || !ref.mounted) return;
    final serial = ++_restoreSerial;
    final generation = _scope.generation;
    bool stale() =>
        !ref.mounted ||
        serial != _restoreSerial ||
        generation != _scope.generation;

    state = state.copyWith(busy: true, clearFailure: true);

    AuthenticatedIdentity? saved;
    bool hasSession = false;
    try {
      saved = await _readIdentity();
      final cookies = await ref
          .read(cookieJarProvider)
          .loadForRequest(backend.resolve('api/_auth/session'));
      hasSession = cookies.any(
        (cookie) => cookie.name == sessionCookieName && cookie.value.isNotEmpty,
      );
    } catch (_) {
      if (stale()) return;
      state = const SessionState(failure: SignInFailure.storage);
      return;
    }
    if (stale()) return;
    final retained = saved != null && saved.backend == backend ? saved : null;
    if (!hasSession) {
      if (retained != null) {
        state = SessionState(phase: SessionPhase.rejected, identity: retained);
        _emit(SessionRejected(retained));
      } else {
        state = const SessionState();
      }
      return;
    }

    final result = await _send(
      method: 'GET',
      backend: backend,
      path: 'api/_auth/session',
    );
    if (stale() || result.cancelled) return;
    final user = readSessionUser(result.data, backend);
    if (result.problem == null && user != null) {
      final stored = await _saveIdentity(user);
      if (stale()) return;
      if (retained != null && !retained.sameAccount(user)) {
        _emit(IdentityCleared(retained, IdentityClearReason.accountSwitch));
        if (stale()) return;
        _scope.invalidate();
      }
      state = SessionState(
        phase: SessionPhase.signedIn,
        identity: user,
        failure: stored ? null : SignInFailure.storage,
      );
      return;
    }
    final rejected =
        result.problem == BackendProblem.authenticationRejected ||
        (result.problem == null && result.statusCode == 200);
    if (!rejected) {
      state = SessionState(
        phase: retained == null
            ? SessionPhase.signedOut
            : SessionPhase.signedIn,
        identity: retained,
        offline: result.problem == BackendProblem.network,
        failure: _failureFor(result.problem),
      );
      return;
    }
    if (retained != null) {
      state = SessionState(phase: SessionPhase.rejected, identity: retained);
      _emit(SessionRejected(retained));
    } else {
      state = const SessionState();
    }
  }

  void _beginClear(IdentityCleared transition) {
    _restoreSerial += 1;
    _emit(transition);
    _scope.invalidate();
    state = const SessionState(busy: true);
  }

  void _emit(IdentityTransition transition) {
    _log.add(transition);
    _pendingEvents.add(transition);
    if (_emitting) return;
    _emitting = true;
    try {
      while (_pendingEvents.isNotEmpty) {
        final next = _pendingEvents.removeAt(0);
        if (!_events.isClosed) _events.add(next);
      }
    } finally {
      _emitting = false;
    }
  }

  Future<BackendResult> _send({
    required String method,
    required Uri backend,
    required String path,
    Object? body,
  }) async {
    final started = _scope.generation;
    final url = backend.resolve(path);
    BackendResult cancelled() =>
        const BackendResult(cancelled: true, problem: BackendProblem.cancelled);
    try {
      if (_mutating.contains(method.toUpperCase())) {
        await _ensureCsrf(backend);
      }
      if (!ref.mounted || started != _scope.generation) return cancelled();
      final response = await ref
          .read(connectionDioProvider)
          .request<Object?>(
            url.toString(),
            data: body,
            cancelToken: _scope.token,
            options: Options(
              method: method,
              followRedirects: false,
              responseType: ResponseType.json,
            ),
          );
      if (!ref.mounted || started != _scope.generation) return cancelled();
      return resultFromResponse(response);
    } on DioException catch (error) {
      if (CancelToken.isCancel(error) || started != _scope.generation) {
        return cancelled();
      }
      return resultFromDio(error);
    } catch (_) {
      if (!ref.mounted || started != _scope.generation) return cancelled();
      return const BackendResult(problem: BackendProblem.storage);
    }
  }

  Future<void> _ensureCsrf(Uri backend) async {
    final probe = backend.resolve('api/native/capabilities');
    final cookies = await ref.read(cookieJarProvider).loadForRequest(probe);
    final ready = cookies.any(
      (cookie) => cookie.name == csrfCookieName && cookie.value.isNotEmpty,
    );
    if (ready) return;
    await ref
        .read(connectionDioProvider)
        .get<Object?>(
          probe.toString(),
          cancelToken: _scope.token,
          options: Options(
            followRedirects: false,
            responseType: ResponseType.json,
          ),
        );
  }

  Future<AuthenticatedIdentity?> _readIdentity() async {
    final raw = await ref.read(secureStorageProvider).read(key: _identityKey);
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    final backend = decoded['backend'];
    final login = decoded['login'];
    final name = decoded['name'];
    final avatar = decoded['avatarUrl'];
    final uri = backend is String ? Uri.tryParse(backend) : null;
    if (uri == null || login is! String || login.isEmpty) return null;
    return AuthenticatedIdentity(
      backend: uri,
      login: login,
      name: name is String && name.isNotEmpty ? name : login,
      avatarUrl: avatar is String ? avatar : '',
    );
  }

  Future<void> _writeIdentity(AuthenticatedIdentity identity) {
    return ref
        .read(secureStorageProvider)
        .write(
          key: _identityKey,
          value: jsonEncode({
            'backend': identity.backend.toString(),
            'login': identity.login,
            'name': identity.name,
            'avatarUrl': identity.avatarUrl,
          }),
        );
  }

  Future<bool> _saveIdentity(AuthenticatedIdentity identity) async {
    try {
      await _queueIdentityWrite(() => _writeIdentity(identity));
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _queueIdentityWrite(Future<void> Function() action) {
    final next = _identityTask.then((_) => action());
    _identityTask = next.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return next;
  }

  Future<void> _deleteIdentity() {
    return ref.read(secureStorageProvider).delete(key: _identityKey);
  }

  static const _mutating = {'POST', 'PUT', 'PATCH', 'DELETE'};

  static SignInFailure _failureFor(BackendProblem? problem) =>
      switch (problem) {
        BackendProblem.invalidCredentials => SignInFailure.invalidCredentials,
        BackendProblem.network => SignInFailure.network,
        BackendProblem.rateLimited => SignInFailure.rateLimited,
        BackendProblem.providerUnavailable => SignInFailure.providerUnavailable,
        BackendProblem.storage => SignInFailure.storage,
        _ => SignInFailure.unavailable,
      };
}
