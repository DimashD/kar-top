import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api.dart';

/// Фоновый обработчик (должен быть top-level). Срабатывает, когда приложение в фоне/закрыто.
@pragma('vm:entry-point')
Future<void> _bgHandler(RemoteMessage message) async {
  // Системное уведомление FCM показывается само; здесь можно дополнительно обработать data.
}

/// Push-уведомления (FCM). Громкий сигнал нового заказа магазину.
/// На web не инициализируется (биометрия/нативные пуши — для мобильных).
class PushService {
  static final PushService instance = PushService._();
  PushService._();

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  // Канал высокой важности — всплывающее уведомление со звуком.
  static const _channel = AndroidNotificationChannel(
    'orders',
    'Заказы',
    description: 'Новые заказы и статусы',
    importance: Importance.max,
    playSound: true,
  );

  Future<void> init() async {
    if (kIsWeb || _ready) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_bgHandler);
      await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);

      await _local.initialize(const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/launcher_icon'),
        iOS: DarwinInitializationSettings(),
      ));
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);

      // В foreground FCM не показывает уведомление сам — показываем локально (громко).
      FirebaseMessaging.onMessage.listen(_showForeground);
      _ready = true;
    } catch (_) {
      // Нет конфигурации Firebase / платформа без пушей — тихо пропускаем.
    }
  }

  void _showForeground(RemoteMessage m) {
    final n = m.notification;
    if (n == null) return;
    _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id, _channel.name,
          channelDescription: _channel.description,
          importance: Importance.max,
          priority: Priority.high,
          playSound: true,
        ),
        iOS: const DarwinNotificationDetails(presentSound: true, presentAlert: true),
      ),
    );
  }

  /// Зарегистрировать FCM-токен на бэкенде (после входа). Платформа — android/ios.
  Future<void> registerToken(Api api) async {
    if (kIsWeb || !_ready) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
      await api.registerPushToken(platform, token);
    } catch (_) {/* не критично */}
  }
}
