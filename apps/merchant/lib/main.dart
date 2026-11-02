import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'session.dart';
import 'theme.dart';
import 'lock.dart';
import 'push.dart';
import 'screens/login_screen.dart';
import 'screens/stores_screen.dart';
import 'screens/lock_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');
  await PushService.instance.init();
  final session = Session();
  await session.bootstrap();
  runApp(ChangeNotifierProvider.value(value: session, child: const KartopMerchantApp()));
}

class KartopMerchantApp extends StatelessWidget {
  const KartopMerchantApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kartop — магазин',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Consumer<Session>(
        builder: (context, session, _) {
          if (session.loading) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
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
