import 'dart:async';
import 'dart:convert';
import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'links.dart';

/// Приложение покупателя Kartop: витрина магазина — та же, что на сайте (WebView),
/// плюс нативное: голосовой список покупок, звонки/WhatsApp/карты во внешних приложениях,
/// ссылки магазинов и заказов открываются прямо в приложении, «Назад» — по страницам.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KartopApp());
}

class KartopApp extends StatelessWidget {
  const KartopApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Kartop',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(useMaterial3: true, colorSchemeSeed: const Color(0xFFD9531E)),
        home: const ShopScreen(),
      );
}

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});
  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  static const _kLastShop = 'last_shop';
  late final WebViewController _web;
  final _speech = SpeechToText();
  final _links = AppLinks();
  StreamSubscription<Uri>? _linkSub;
  int _progress = 0;
  bool _failed = false;
  bool _listening = false;
  String _heard = '';

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFFBF8F5))
      // Сайт узнаёт приложение по этому каналу: «Сказать голосом» зовёт нативное распознавание.
      ..addJavaScriptChannel('KartopApp', onMessageReceived: (m) => _onWebMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => _progress = p),
        onPageFinished: (url) { _rememberShop(Uri.parse(url)); _sendPushToken(); },
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? false) setState(() => _failed = true);
        },
        onNavigationRequest: (req) {
          final uri = Uri.parse(req.url);
          if (isOwnPage(uri) || uri.scheme == 'about' || uri.scheme == 'data') return NavigationDecision.navigate;
          // Звонок, WhatsApp, Kaspi, 2ГИС, Google Play — во внешних приложениях.
          launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ));
    // «Моё местоположение» на карте выбора адреса: спрашиваем разрешение Android и отдаём странице.
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (req) async {
          final granted = (await Permission.locationWhenInUse.request()).isGranted;
          return GeolocationPermissionsResponse(allow: granted, retain: false);
        },
      );
    }
    _start();
    _initPush();
  }

  String? _pushToken;

  /// Пуши о заказе: токен отдаём странице (она регистрирует его на вошедшего покупателя),
  /// нажатие на уведомление открывает заказ (data.url).
  Future<void> _initPush() async {
    try {
      await Firebase.initializeApp();
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission(alert: true, badge: true, sound: true);
      _pushToken = await fm.getToken();
      fm.onTokenRefresh.listen((t) { _pushToken = t; _sendPushToken(); });
      _sendPushToken();
      final first = await fm.getInitialMessage();
      if (first != null) _openFromPush(first);
      FirebaseMessaging.onMessageOpenedApp.listen(_openFromPush);
      // Приложение открыто — показываем уведомление внизу экрана с кнопкой «Открыть».
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n == null || !mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text([n.title, n.body].whereType<String>().join('\n')),
          duration: const Duration(seconds: 6),
          action: m.data['url'] == null ? null : SnackBarAction(label: 'Открыть', onPressed: () => _openFromPush(m)),
        ));
      });
    } catch (_) {
      // Нет Firebase на этой сборке — работаем без пушей.
    }
  }

  void _openFromPush(RemoteMessage m) {
    final url = m.data['url'];
    final uri = url is String ? Uri.tryParse(url) : null;
    if (uri != null && isOwnPage(uri)) _open(uri);
  }

  Future<void> _sendPushToken() async {
    final t = _pushToken;
    if (t == null) return;
    try {
      await _web.runJavaScript(
          'window.kartopPushToken=${jsonEncode(t)};window.dispatchEvent(new Event("kartop-push-token"));');
    } catch (_) {/* страница ещё грузится — отправим в onPageFinished */}
  }

  Future<void> _start() async {
    final initial = await _links.getInitialLink();
    final page = initial == null ? null : pageForLink(initial);
    if (page != null) {
      _open(page);
    } else {
      // Без ссылки — последний магазин, иначе главная.
      final prefs = await SharedPreferences.getInstance();
      final slug = prefs.getString(_kLastShop);
      _open(Uri.parse(slug == null ? kWebBase : '$kWebBase/$slug'));
    }
    _linkSub = _links.uriLinkStream.listen((link) {
      final p = pageForLink(link);
      if (p != null) _open(p);
    });
  }

  void _open(Uri uri) {
    setState(() => _failed = false);
    _web.loadRequest(uri);
  }

  Future<void> _rememberShop(Uri uri) async {
    final slug = shopSlugOf(uri);
    if (slug == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLastShop, slug);
  }

  /// Сообщения со страницы: «voice:ru» — начать голосовой ввод на языке сайта.
  void _onWebMessage(String msg) {
    if (msg.startsWith('voice')) {
      final lang = msg.contains(':') ? msg.split(':')[1] : 'ru';
      _listen(lang);
    }
  }

  Future<void> _listen(String lang) async {
    final ok = await _speech.initialize(onStatus: (s) {
      if (s == 'done' || s == 'notListening') _finishListening();
    }, onError: (_) => _finishListening());
    if (!ok) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Голосовой ввод недоступен на этом телефоне')));
      }
      return;
    }
    setState(() { _listening = true; _heard = ''; });
    final locale = switch (lang) { 'kk' => 'kk_KZ', 'en' => 'en_US', _ => 'ru_RU' };
    await _speech.listen(
      listenOptions: SpeechListenOptions(localeId: locale, listenFor: const Duration(seconds: 60), pauseFor: const Duration(seconds: 4)),
      onResult: (r) => setState(() => _heard = r.recognizedWords),
    );
  }

  /// Передаём распознанный текст на страницу — он попадает в «Списком» и разбирается как набранный.
  Future<void> _finishListening() async {
    if (!_listening) return;
    await _speech.stop();
    final text = _heard.trim();
    setState(() => _listening = false);
    if (text.isNotEmpty) {
      await _web.runJavaScript('window.kartopVoiceResult && window.kartopVoiceResult(${jsonEncode(text)});');
    }
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    _speech.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      // «Назад» — по страницам витрины; на первой странице — выход.
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (_listening) { await _finishListening(); return; }
        if (await _web.canGoBack()) {
          await _web.goBack();
        } else {
          await SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFBF8F5),
        body: SafeArea(
          child: Stack(
            children: [
              if (_failed) _offline() else WebViewWidget(controller: _web),
              if (_progress < 100 && !_failed)
                LinearProgressIndicator(value: _progress / 100, minHeight: 2, color: const Color(0xFFD9531E), backgroundColor: Colors.transparent),
              if (_listening) _listeningPanel(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _offline() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 48, color: Color(0xFF9A8F88)),
              const SizedBox(height: 12),
              const Text('Нет соединения', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              const Text('Проверьте интернет и попробуйте ещё раз.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF6B5F57))),
              const SizedBox(height: 20),
              FilledButton(onPressed: () { setState(() => _failed = false); _web.reload(); }, child: const Text('Повторить')),
            ],
          ),
        ),
      );

  // Панель «Слушаю…»: что уже распознано и кнопка «Готово».
  Widget _listeningPanel() => Positioned(
        left: 0, right: 0, bottom: 0,
        child: Material(
          elevation: 12,
          color: Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(children: [
                  Icon(Icons.mic, color: Color(0xFFD9531E), size: 28),
                  SizedBox(width: 10),
                  Text('Слушаю… Говорите список покупок', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                ]),
                const SizedBox(height: 10),
                Text(_heard.isEmpty ? '«помидоры килограмм, картошка три кило, лук»' : _heard,
                    style: TextStyle(fontSize: 16, color: _heard.isEmpty ? const Color(0xFF9A8F88) : const Color(0xFF1A1512))),
                const SizedBox(height: 16),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD9531E), minimumSize: const Size.fromHeight(52)),
                  onPressed: _finishListening,
                  child: const Text('Готово', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
        ),
      );
}
