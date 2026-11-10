import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config.dart';
import 'l10n.dart';
import 'session.dart';
import 'theme.dart';
import 'lock.dart';
import 'push.dart';
import 'screens/login_screen.dart';
import 'screens/stores_screen.dart';
import 'screens/lock_screen.dart';
import 'screens/language_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Данные дат для всех языков (ru, kk, uz; таджикский показывает даты по-русски).
  await initializeDateFormatting();
  await PushService.instance.init();
  final session = Session();
  final lang = Lang();
  await Future.wait([session.bootstrap(), lang.load()]);
  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: session),
      ChangeNotifierProvider.value(value: lang),
    ],
    child: const KartopMerchantApp(),
  ));
}

class KartopMerchantApp extends StatelessWidget {
  const KartopMerchantApp({super.key});
  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: s.appTitle,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      // Тестовая сборка (flavor staging) — лента «ТЕСТ», чтобы не перепутать с боевым приложением.
      builder: kIsStaging
          ? (context, child) => Banner(
                message: s.testBanner,
                location: BannerLocation.topEnd,
                color: const Color(0xFFC62828),
                child: child ?? const SizedBox.shrink(),
              )
          : null,
      home: Consumer<Session>(
        builder: (context, session, _) {
          if (session.loading) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          // Первый запуск — сначала язык, потом вход.
          if (!context.watch<Lang>().chosen) return const LanguageScreen();
          return session.isAuthed ? const LockGate(child: StoresScreen()) : const LoginScreen();
        },
      ),
    );
  }
}

/// Показывает экран блокировки поверх приложения, если замок включён
/// (на холодном старте и при возврате из фона).
class LockGate extends StatefulWidget {
  final Widget child;
  const LockGate({super.key, required this.child});
  @override
  State<LockGate> createState() => _LockGateState();
}

class _LockGateState extends State<LockGate> with WidgetsBindingObserver {
  bool _locked = false;
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    AppLock.isEnabled().then((on) => setState(() { _locked = on; _checked = true; }));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      AppLock.isEnabled().then((on) { if (on && mounted) setState(() => _locked = true); });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) return const Scaffold(body: SizedBox.shrink());
    if (_locked) return LockScreen(onUnlocked: () => setState(() => _locked = false));
    return widget.child;
  }
}
