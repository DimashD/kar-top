import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Замок приложения: вход по биометрии (Face ID / отпечаток) или 4-значному PIN.
/// PIN хранится только как SHA-256 в защищённом хранилище (Keychain/Keystore).
class AppLock {
  static const _storage = FlutterSecureStorage();
  static const _kEnabled = 'lock_enabled';
  static const _kPin = 'lock_pin_hash';
  static final _auth = LocalAuthentication();

  static String _hash(String pin) => sha256.convert(utf8.encode(pin)).toString();

  static Future<bool> isEnabled() async {
    try {
      return (await _storage.read(key: _kEnabled)) == '1';
    } catch (_) {
      return false;
    }
  }

  static Future<void> enable(String pin) async {
    await _storage.write(key: _kPin, value: _hash(pin));
    await _storage.write(key: _kEnabled, value: '1');
  }

  static Future<void> disable() async {
    await _storage.delete(key: _kPin);
    await _storage.write(key: _kEnabled, value: '0');
  }

  static Future<bool> verifyPin(String pin) async {
    try {
      final h = await _storage.read(key: _kPin);
      return h != null && h == _hash(pin);
    } catch (_) {
      return false;
    }
  }

  /// Доступна ли биометрия на устройстве (на web — нет).
  static Future<bool> biometricAvailable() async {
    if (kIsWeb) return false;
    try {
      return await _auth.canCheckBiometrics && await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  /// Запрос биометрии. true — успех.
  static Future<bool> authenticateBiometric(String reason) async {
    if (kIsWeb) return false;
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
    } catch (_) {
      return false;
    }
  }
}
