import 'package:intl/intl.dart';
import 'l10n.dart';

/// Тиыны → «1 290 ₸».
String tenge(int tiyn) {
  final t = (tiyn / 100).round();
  final s = t.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
  return '$s ₸';
}

/// Граммы → «1.5 кг» / «500 г».
String grams(S s, int g) {
  if (g >= 1000) {
    final kg = (g / 1000).toStringAsFixed(1).replaceAll('.0', '');
    return '$kg ${s.unitKg}';
  }
  return '$g ${s.unitG}';
}

/// Подпись единицы измерения (KG, G, PCS, BUNCH, PACK).
String unitLabel(S s, String unit) {
  switch (unit) {
    case 'KG':
      return s.unitKg;
    case 'G':
      return s.unitG;
    case 'BUNCH':
      return s.unitBunch;
    case 'PACK':
      return s.unitPack;
    default:
      return s.unitPcs;
  }
}

String payLabel(S s, String p) {
  switch (p) {
    case 'CASH':
      return s.payCash;
    case 'CARD_COURIER':
      return s.payCardCourier;
    case 'KASPI_TRANSFER':
      return s.payKaspi;
    default:
      return p;
  }
}

String statusLabel(S s, String status) => s.statuses[status] ?? status;

String dateTime(S s, DateTime d) => DateFormat('d MMM, HH:mm', s.dateLocale).format(d.toLocal());

/// Окно получения, выбранное покупателем: «11 нояб., 18:00–20:00» (слоты по 2 часа).
String timeSlot(S s, DateTime d) => '${dateTime(s, d)}–${DateFormat('HH:mm').format(d.toLocal().add(const Duration(hours: 2)))}';
