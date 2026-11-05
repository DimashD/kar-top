// Базовый smoke-тест: приложение собирается и показывает экран входа на выбранном языке.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:kartop_merchant/l10n.dart';
import 'package:kartop_merchant/session.dart';
import 'package:kartop_merchant/theme.dart';
import 'package:kartop_merchant/screens/login_screen.dart';

Widget _app(Lang lang) => MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => Session()),
        ChangeNotifierProvider.value(value: lang),
      ],
      child: MaterialApp(theme: buildTheme(), home: const LoginScreen()),
    );

void main() {
  testWidgets('экран входа отображается', (WidgetTester tester) async {
    await tester.pumpWidget(_app(Lang()));
    expect(find.text('Kartop'), findsOneWidget);
    expect(find.text('Получить код'), findsOneWidget);
  });

  testWidgets('переключение языка меняет тексты', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final lang = Lang();
    await tester.pumpWidget(_app(lang));
    await lang.set('kk');
    await tester.pump();
    expect(find.text('Код алу'), findsOneWidget);
    await lang.set('uz');
    await tester.pump();
    expect(find.text('Kod olish'), findsOneWidget);
    await lang.set('tg');
    await tester.pump();
    expect(find.text('Гирифтани код'), findsOneWidget);
  });

  test('у каждого языка заданы все статусы заказа', () {
    for (final code in Lang.supported) {
      expect(S.forCode(code).statuses.keys, S.forCode('ru').statuses.keys, reason: code);
    }
  });
}
