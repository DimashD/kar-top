// Базовый smoke-тест: приложение собирается и показывает экран входа.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:kartop_merchant/session.dart';
import 'package:kartop_merchant/theme.dart';
import 'package:kartop_merchant/screens/login_screen.dart';

void main() {
  testWidgets('экран входа отображается', (WidgetTester tester) async {
    final session = Session();
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: session,
        child: MaterialApp(theme: buildTheme(), home: const LoginScreen()),
      ),
    );
    expect(find.text('Kartop'), findsOneWidget);
    expect(find.text('Получить код'), findsOneWidget);
  });
}
