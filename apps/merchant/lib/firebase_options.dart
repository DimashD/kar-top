// Конфигурация Firebase для приложения (проект kartop).
// Значения из google-services.json (Android) и GoogleService-Info.plist (iOS).
// Это клиентские ключи (не секреты) — они и так уезжают внутри приложения.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Firebase для web не настроен (пуши — только мобильные).');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase не настроен для $defaultTargetPlatform');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAvM06xzBmwU1K90PIswHENj1ApbqZu_PA',
    appId: '1:244786869533:android:513616669015bfb86fddf4',
    messagingSenderId: '244786869533',
    projectId: 'kartop',
    storageBucket: 'kartop.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCFPLQkhE2enZ9WmaFvK_hE1rH2tG_OBqA',
    appId: '1:244786869533:ios:852226a5ad6a4d086fddf4',
    messagingSenderId: '244786869533',
    projectId: 'kartop',
    storageBucket: 'kartop.firebasestorage.app',
    iosBundleId: 'kz.kartop.kartopmerchant',
  );
}
