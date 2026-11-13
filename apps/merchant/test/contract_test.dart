// Экраны «Согласие на обработку данных» и «Договор»: кнопки не работают, пока не выполнены условия.
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:kartop_merchant/l10n.dart';
import 'package:kartop_merchant/session.dart';
import 'package:kartop_merchant/theme.dart';
import 'package:kartop_merchant/screens/contract_screen.dart';

Widget _app(Lang lang, Widget child) => MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => Session()),
        ChangeNotifierProvider.value(value: lang),
      ],
      child: MaterialApp(theme: buildTheme(), home: Scaffold(body: child)),
    );

FilledButton _button(WidgetTester t, String text) =>
    t.widget<FilledButton>(find.ancestor(of: find.text(text), matching: find.byType(FilledButton)));

// Высокий экран: список строится лениво, кнопки внизу должны попасть в кадр.
void _tall(WidgetTester t) {
  t.view.physicalSize = const Size(800, 2400);
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('согласие: «Продолжить» работает только после отметки', (t) async {
    _tall(t);
    await t.pumpWidget(_app(Lang(), ConsentView(onDone: () {})));
    final s = S.forCode('ru');
    expect(find.text(s.consentAgree), findsOneWidget);
    expect(find.text(s.consentTerms), findsOneWidget);
    expect(_button(t, s.consentContinue).onPressed, isNull);
    await t.tap(find.byType(Checkbox));
    await t.pump();
    expect(_button(t, s.consentContinue).onPressed, isNotNull);
  });

  testWidgets('договор: кнопка работает только с ИП/ТОО и ИИН/БИН из 12 цифр', (t) async {
    _tall(t);
    await t.pumpWidget(_app(Lang(), ContractView(storeId: 's1', onDone: () {})));
    final s = S.forCode('ru');
    expect(find.text(s.contractTitle), findsOneWidget);
    expect(find.text(s.contractPoints), findsOneWidget);
    expect(_button(t, s.contractAccept).onPressed, isNull);
    final fields = find.byType(TextField);
    await t.enterText(fields.at(0), 'ИП Иванов');
    await t.enterText(fields.at(1), '12345');
    await t.pump();
    expect(_button(t, s.contractAccept).onPressed, isNull);
    await t.enterText(fields.at(1), '123456789012');
    await t.pump();
    expect(_button(t, s.contractAccept).onPressed, isNotNull);
  });

  testWidgets('экраны переведены на все языки', (t) async {
    _tall(t);
    final lang = Lang();
    await t.pumpWidget(_app(lang, ContractView(storeId: 's1', onDone: () {})));
    for (final code in Lang.supported) {
      await lang.set(code);
      await t.pump();
      expect(find.text(S.forCode(code).contractTitle), findsOneWidget, reason: code);
      expect(find.text(S.forCode(code).contractFullText), findsOneWidget, reason: code);
    }
  });
}
