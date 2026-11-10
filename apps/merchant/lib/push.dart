import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api.dart';
import 'firebase_options.dart';
import 'session.dart';
import 'screens/order_detail_screen.dart';

/// Навигатор приложения — чтобы открыть заказ по нажатию на уведомление из любого места.
final navigatorKey = GlobalKey<NavigatorState>();

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
      // Android: настройки из google-services.json своей сборки (у тестовой и боевой — разные приложения Firebase);
      // iOS — из firebase_options.dart.
      await Firebase.initializeApp(options: defaultTargetPlatform == TargetPlatform.iOS ? DefaultFirebaseOptions.currentPlatform : null);
      FirebaseMessaging.onBackgroundMessage(_bgHandler);
      await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);

      await _local.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/launcher_icon'),
          iOS: DarwinInitializationSettings(),
        ),
        // Нажатие на уведомление, показанное, пока приложение открыто: в payload — id заказа.
        onDidReceiveNotificationResponse: (r) => openOrder(r.payload),
      );
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);

      // В foreground FCM не показывает уведомление сам — показываем локально (громко).
      FirebaseMessaging.onMessage.listen(_showForeground);
      // Нажатие на уведомление: приложение было закрыто / в фоне — открываем заказ.
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _fromMessage(initial);
      FirebaseMessaging.onMessageOpenedApp.listen(_fromMessage);
      _ready = true;
    } catch (_) {
      // Нет конфигурации Firebase / платформа без пушей — тихо пропускаем.
    }
  }

  /// Заказ, который нужно открыть, когда приложение будет готово (вход, выбран магазин).
  String? _pendingOrder;

  void _fromMessage(RemoteMessage m) {
    if ('${m.data['type']}'.startsWith('order.')) openOrder(m.data['id'] as String?);
  }

  /// Открыть экран заказа. Если магазин ещё не выбран (холодный старт, вход) — откроем позже, см. [openPending].
  void openOrder(String? orderId) {
    if (orderId == null || orderId.isEmpty) return;
    final ctx = navigatorKey.currentContext;
    if (ctx == null || ctx.read<Session>().store == null) {
      _pendingOrder = orderId;
      return;
    }
    _pendingOrder = null;
    navigatorKey.currentState!.push(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: orderId)));
  }

  /// Вызывается, когда магазин выбран: открыть заказ из уведомления, если он ждёт.
  void openPending() {
    final id = _pendingOrder;
    if (id != null) WidgetsBinding.instance.addPostFrameCallback((_) => openOrder(id));
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
      payload: '${m.data['type']}'.startsWith('order.') ? m.data['id'] as String? : null,
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
