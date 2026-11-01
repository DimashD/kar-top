import 'package:intl/intl.dart';

/// Тиыны → «1 290 ₸».
String tenge(int tiyn) {
  final t = (tiyn / 100).round();
  final s = t.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
  return '$s ₸';
}

/// Граммы → «1.5 кг» / «500 г».
String grams(int g) {
  if (g >= 1000) {
    final kg = (g / 1000).toStringAsFixed(1).replaceAll('.0', '');
    return '$kg кг';
  }
  return '$g г';
}

String payLabel(String p) {
  switch (p) {
    case 'CASH':
      return 'Наличными';
    case 'CARD_COURIER':
      return 'Картой курьеру';
    case 'KASPI_TRANSFER':
      return 'Перевод Kaspi';
    default:
      return p;
  }
}

String statusLabel(String s) {
  const m = {
    'PLACED': 'Новый',
    'ACCEPTED': 'Принят',
    'PICKING': 'Сборка',
    'AWAITING_CUSTOMER': 'Ждём клиента',
    'READY': 'Готов',
    'COURIER_ASSIGNED': 'Курьер назначен',
    'DELIVERING': 'В пути',
    'DELIVERED': 'Доставлен',
    'COMPLETED': 'Завершён',
    'CANCELLED': 'Отменён',
  };
  return m[s] ?? s;
}

String dateTime(DateTime d) => DateFormat('d MMM, HH:mm', 'ru').format(d.toLocal());
