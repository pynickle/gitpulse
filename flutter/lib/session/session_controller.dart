import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import 'gitpulse_http.dart';
import 'native_login_handoff.dart';
import 'secure_storage.dart';

const _identityKey = 'authenticated_identity';

enum SessionPhase { restoring, signedOut, signedIn, rejected }

enum SignInFailure {
  invalidCredentials,
  network,
  rateLimited,
  providerUnavailable,
  storage,
  unavailable,
  browserLaunch,
  expired,
  cancelled,
  incompleteIdentity,
}

enum IdentityClearReason {
  signOut,
  backendChange,
  accountSwitch,
  invalidIdentity,
}

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
    this.browserSignInCode,
  });

  final SessionPhase phase;
  final AuthenticatedIdentity? identity;
  final bool busy;
  final SignInFailure? failure;
  final bool offline;
  final String? browserSignInCode;

  SessionState copyWith({
    SessionPhase? phase,
    AuthenticatedIdentity? identity,
    bool clearIdentity = false,
    bool? busy,
    SignInFailure? failure,
    bool clearFailure = false,
    bool? offline,
    String? browserSignInCode,
    bool clearBrowserSignIn = false,
  }) {
    return SessionState(
      phase: phase ?? this.phase,
      identity: clearIdentity ? null : identity ?? this.identity,
      busy: busy ?? this.busy,
      failure: clearFailure ? null : failure ?? this.failure,
      offline: offline ?? this.offline,
      browserSignInCode: clearBrowserSignIn
          ? null
          : browserSignInCode ?? this.browserSignInCode,
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
  Future<void>? _restoration;
  NativeLoginAttempt? _browserAttempt;
  NativeLoginAttempt? _pollingAttempt;
  Timer? _pollTimer;
  int _browserEpoch = 0;
  bool _foreground = true;

  Stream<IdentityTransition> get transitions => _events.stream;

  List<IdentityTransition> get transitionLog => List.unmodifiable(_log);

  @override
  SessionState build() {
    final lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        if (state == AppLifecycleState.resumed) {
          resumeBrowserSignIn();
        } else {
          pauseBrowserSignIn();
        }
      },
    );
    ref.onDispose(() {
      lifecycle.dispose();
      _discardBrowserAttempt();
      _scope.invalidate();
      _events.close();
    });
    ref.listen(connectionControllerProvider, (previous, next) {
      final backend = next.value?.backend;
      if (backend == null) return;
      if (previous?.value?.backend?.address == backend.address) return;
      _startRestore(backend.address);
    });
    final backend = ref.read(connectionControllerProvider).value?.backend;
    if (backend != null) {
      Future<void>.microtask(() => _startRestore(backend.address));
    }
    return const SessionState(phase: SessionPhase.restoring, busy: true);
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

  Future<void> startBrowserSignIn() async {
    final backend = ref.read(connectionControllerProvider).value?.backend;
    if (backend == null ||
        _clearing ||
        (state.busy && _browserAttempt == null)) {
      return;
    }
    if (!backend.capabilities.supportsNativeLogin) {
      state = state.copyWith(failure: SignInFailure.providerUnavailable);
      return;
    }
    _scope.invalidate();
    _restoreSerial++;
    final previous = _discardBrowserAttempt();
    if (previous != null) unawaited(_cancelAttempt(previous));
    final epoch = _browserEpoch;
    state = state.copyWith(
      busy: true,
      clearFailure: true,
      clearBrowserSignIn: true,
    );
    final verifier = createNativeLoginVerifier();
    final result = await _send(
      method: 'POST',
      backend: backend.address,
      path: 'auth/native/create',
      body: {
        'challenge': nativeLoginChallenge(verifier),
        'origin': backend.address.origin,
      },
    );
    if (!ref.mounted || epoch != _browserEpoch || result.cancelled) return;
    if (result.problem != null) {
      state = state.copyWith(busy: false, failure: _failureFor(result.problem));
      return;
    }
    try {
      final attempt = NativeLoginAttempt.fromResponse(
        result.data,
        backend.address,
        verifier,
      );
      _browserAttempt = attempt;
      state = state.copyWith(browserSignInCode: attempt.confirmationCode);
      final launched = await ref.read(browserLauncherProvider)(
        attempt.browserUrl,
      );
      if (!ref.mounted || epoch != _browserEpoch) return;
      if (!launched) throw StateError('Could not open system browser');
      unawaited(pollBrowserSignIn());
    } catch (_) {
      if (!ref.mounted || epoch != _browserEpoch) return;
      await cancelBrowserSignIn(failure: SignInFailure.browserLaunch);
    }
  }

  Future<void> pollBrowserSignIn() async {
    final attempt = _browserAttempt;
    if (attempt == null || !_foreground || _pollingAttempt == attempt) return;
    _pollTimer?.cancel();
    if (!ref.read(nativeLoginClockProvider)().isBefore(attempt.expiresAt)) {
      await cancelBrowserSignIn(failure: SignInFailure.expired);
      return;
    }
    _pollingAttempt = attempt;
    var delay = attempt.interval;
    try {
      final result = await _send(
        method: 'GET',
        backend: attempt.backend,
        path: 'auth/native/status?id=${Uri.encodeQueryComponent(attempt.id)}',
        headers: {
          'x-native-verifier': attempt.verifier,
          'x-native-origin': attempt.backend.origin,
        },
      );
      if (!ref.mounted ||
          _browserAttempt != attempt ||
          result.cancelled ||
          !_foreground) {
        return;
      }
      if (result.statusCode == 410 || result.statusCode == 404) {
        await cancelBrowserSignIn(failure: SignInFailure.expired);
        return;
      }
      if (result.problem != null) {
        delay = const Duration(seconds: 10);
        state = state.copyWith(failure: _failureFor(result.problem));
        return;
      }
      final data = result.data;
      final status = data is Map ? data['status'] : null;
      if (status == 'approved') {
        _discardBrowserAttempt();
        state = state.copyWith(busy: false, clearBrowserSignIn: true);
        await _signIn(path: 'auth/native/redeem', body: attempt.proof);
      } else if (status == 'cancelled' ||
          status == 'expired' ||
          status == 'redeemed') {
        await cancelBrowserSignIn(
          failure: status == 'expired'
              ? SignInFailure.expired
              : SignInFailure.cancelled,
        );
      } else if (status == 'pending') {
        state = state.copyWith(clearFailure: true);
      } else {
        await cancelBrowserSignIn(failure: SignInFailure.unavailable);
      }
    } finally {
      if (_pollingAttempt == attempt) _pollingAttempt = null;
      if (ref.mounted && _browserAttempt == attempt && _foreground) {
        _pollTimer = Timer(delay, () => unawaited(pollBrowserSignIn()));
      }
    }
  }

  void pauseBrowserSignIn() {
    _foreground = false;
    _pollTimer?.cancel();
  }

  void resumeBrowserSignIn() {
    _foreground = true;
    unawaited(pollBrowserSignIn());
  }

  Future<void> cancelBrowserSignIn({
    SignInFailure failure = SignInFailure.cancelled,
  }) async {
    _scope.invalidate();
    _restoreSerial++;
    final attempt = _discardBrowserAttempt();
    state = state.copyWith(
      busy: false,
      clearBrowserSignIn: true,
      failure: failure,
    );
    if (attempt != null) await _cancelAttempt(attempt);
  }

  NativeLoginAttempt? _discardBrowserAttempt() {
    _browserEpoch++;
    _pollTimer?.cancel();
    final attempt = _browserAttempt;
    _browserAttempt = null;
    return attempt;
  }

  Future<void> _cancelAttempt(NativeLoginAttempt attempt) async {
    // Failure is harmless: the server still enforces the short expiry.
    await _send(
      method: 'POST',
      backend: attempt.backend,
      path: 'auth/native/cancel',
      body: attempt.proof,
    );
  }

  /// Clears the signed-in identity before logout finishes so in-flight work
  /// cannot commit against the previous account.
  ///
  /// Signing in again afterwards is how another account is chosen: the same
  /// clearing boundary applies, so a separate entry point would only rename this
  /// one.
  Future<void> signOut() async {
    await _clearIdentity(IdentityClearReason.signOut);
  }

  /// Backend changes drop the previous identity before the connection screen
  /// returns, including when the server cannot be reached.
  Future<void> leaveBackend({String? address}) async {
    await _clearIdentity(IdentityClearReason.backendChange);
    if (address != null &&
        ref.mounted &&
        ref.read(connectionControllerProvider).value?.backend == null) {
      await ref.read(connectionControllerProvider.notifier).connect(address);
    }
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
        if (reason != IdentityClearReason.invalidIdentity) {
          final result = await _send(
            method: 'POST',
            backend: backend.address,
            path: 'auth/logout',
          );
          storageFailed |= result.problem == BackendProblem.storage;
        }
        if (!ref.mounted) return;
        try {
          await ref.read(cookieJarProvider).delete(backend.address, true);
        } catch (_) {
          storageFailed = true;
        }
      }
      if (!ref.mounted) return;
      state = SessionState(
        failure: storageFailed
            ? SignInFailure.storage
            : reason == IdentityClearReason.invalidIdentity
            ? SignInFailure.incompleteIdentity
            : null,
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
    // Saved content can be read immediately. Requests wait for the restored
    // cookie's account to be checked before fetching or changing account data.
    final generation = _scope.generation;
    await _restoration;
    if (!ref.mounted || generation != _scope.generation) {
      return const BackendResult(
        cancelled: true,
        problem: BackendProblem.cancelled,
      );
    }
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
    } else if (result.problem == null && state.phase == SessionPhase.signedIn) {
      // Coming back does not leave the sign-in sentence behind. A signed-in
      // reader who lost the network was never a failed sign-in.
      final staleNetworkFailure = state.failure == SignInFailure.network;
      if (state.offline || staleNetworkFailure) {
        state = state.copyWith(
          offline: false,
          clearFailure: staleNetworkFailure,
        );
      }
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
      final switched = previous != null && !previous.sameAccount(user);
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
    if (result.problem == null) {
      await _clearIdentity(IdentityClearReason.invalidIdentity);
      return;
    }
    state = SessionState(
      phase: phase,
      identity: previous,
      failure: _failureFor(result.problem),
    );
  }

  void _startRestore(Uri backend) {
    final restoration = _restore(backend);
    _restoration = restoration;
    unawaited(
      restoration.whenComplete(() {
        if (identical(_restoration, restoration)) _restoration = null;
      }),
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

    state = const SessionState(phase: SessionPhase.restoring, busy: true);

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
    } on FormatException {
      if (stale()) return;
      await _clearIdentity(IdentityClearReason.invalidIdentity);
      return;
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

    if (retained != null) {
      state = SessionState(phase: SessionPhase.signedIn, identity: retained);
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
    if (result.problem == null &&
        result.data is Map &&
        (result.data as Map)['user'] is Map) {
      await _clearIdentity(IdentityClearReason.invalidIdentity);
      return;
    }
    final rejected =
        result.problem == BackendProblem.authenticationRejected ||
        (result.problem == null && result.statusCode == 200);
    if (!rejected) {
      final signedIn = retained != null;
      final network = result.problem == BackendProblem.network;
      state = SessionState(
        phase: signedIn ? SessionPhase.signedIn : SessionPhase.signedOut,
        identity: retained,
        offline: network,
        // Already signed in and unreachable is offline reading, not a sign-in
        // that failed. The sign-in sentence stays on the sign-in form.
        failure: network && signedIn ? null : _failureFor(result.problem),
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
    final attempt = _discardBrowserAttempt();
    _restoreSerial += 1;
    _emit(transition);
    _scope.invalidate();
    if (attempt != null) unawaited(_cancelAttempt(attempt));
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
    Map<String, String>? headers,
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
              headers: headers,
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
    final githubId = decoded['githubId'];
    if (githubId is! String || (int.tryParse(githubId) ?? 0) <= 0) {
      throw const FormatException('Incomplete account identity');
    }
    final login = decoded['login'];
    final name = decoded['name'];
    final avatar = decoded['avatarUrl'];
    final uri = backend is String ? Uri.tryParse(backend) : null;
    if (uri == null || login is! String || login.isEmpty) return null;
    return AuthenticatedIdentity(
      githubId: githubId,
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
            'githubId': identity.githubId,
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
