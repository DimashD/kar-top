import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'session.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/stores_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ru');
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
          return session.isAuthed ? const StoresScreen() : const LoginScreen();
        },
      ),
    );
  }
}
