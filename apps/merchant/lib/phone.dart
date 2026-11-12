import 'package:flutter/services.dart';

/// Единый формат телефона Казахстана: +7 7XX XXX XX XX (как на сайте, apps/web/lib/phone.ts).
/// Показываем отформатированную строку; на сервер уходит E.164 (+77XXXXXXXXX).

/// Только цифры, страна 7, максимум 11 знаков (7 + 10). «8…» → «7…».
String kzDigits(String raw) {
  var d = raw.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('8')) d = '7${d.substring(1)}';
  if (d.isNotEmpty && !d.startsWith('7')) d = '7$d';
  return d.length > 11 ? d.substring(0, 11) : d;
}

/// +77011115999 → «+7 701 111 59 99» (и по мере набора).
String formatKzPhone(String raw) {
  final d = kzDigits(raw);
  if (d.length <= 1) return '+7';
  final rest = d.substring(1);
  final parts = <String>[];
  for (final (from, to) in const [(0, 3), (3, 6), (6, 8), (8, 10)]) {
    if (rest.length > from) parts.add(rest.substring(from, rest.length < to ? rest.length : to));
  }
  return '+7 ${parts.join(' ')}';
}

/// Валидный мобильный РК: +7 7XX XXX XX XX.
bool isValidKzPhone(String raw) => RegExp(r'^77\d{9}$').hasMatch(kzDigits(raw));

/// Формат для API: +77XXXXXXXXX.
String kzPhoneE164(String raw) => '+${kzDigits(raw)}';

/// Маска ввода: пользователь печатает цифры — в поле сразу «+7 701 111 59 99».
class KzPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = formatKzPhone(newValue.text);
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
