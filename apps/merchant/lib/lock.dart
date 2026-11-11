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
  static const _kBio = 'lock_bio';
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
    await _storage.write(key: _kBio, value: '0');
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

  /// Вход по биометрии включён пользователем (по умолчанию — да, если замок включён).
  static Future<bool> biometricEnabled() async {
    try {
      return (await _storage.read(key: _kBio)) != '0';
    } catch (_) {
      return false;
    }
  }

  static Future<void> setBiometricEnabled(bool on) => _storage.write(key: _kBio, value: on ? '1' : '0');

  /// Доступна ли биометрия на устройстве (на web — нет): есть датчик и хотя бы один отпечаток/лицо.
  static Future<bool> biometricAvailable() async {
    if (kIsWeb) return false;
    try {
      if (!await _auth.isDeviceSupported()) return false;
      return await _auth.canCheckBiometrics || (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Запрос биометрии. true — успех. Только отпечаток/лицо: системный код телефона
  /// открыл бы отдельный экран, приложение ушло бы в фон и снова заблокировалось.
  static Future<bool> authenticateBiometric(String reason) async {
    if (kIsWeb) return false;
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
    } catch (e) {
      debugPrint('biometric: $e');
      return false;
    }
  }
}
