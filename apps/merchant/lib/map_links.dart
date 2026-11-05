import 'package:url_launcher/url_launcher.dart';

/// Маршрут до клиента: сначала приложение 2ГИС, затем сайт 2ГИС (откроет приложение, если оно есть),
/// в последнюю очередь — Google Maps. Если точки нет, ищем по адресу.
/// Возвращает false, если не открылось ничего.
Future<bool> openRoute({double? lat, double? lng, String? address}) async {
  final hasPoint = lat != null && lng != null;
  final query = Uri.encodeComponent(address ?? '');
  final candidates = <Uri>[
    if (hasPoint) ...[
      // 2ГИС принимает координаты в порядке «долгота,широта».
      Uri.parse('dgis://2gis.ru/routeSearch/rsType/car/to/$lng,$lat'),
      Uri.parse('https://2gis.kz/routeSearch/rsType/car/to/$lng,$lat'),
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'),
    ] else if (query.isNotEmpty) ...[
      Uri.parse('dgis://2gis.ru/search/$query'),
      Uri.parse('https://2gis.kz/search/$query'),
      Uri.parse('https://www.google.com/maps/search/?api=1&query=$query'),
    ],
  ];
  for (final uri in candidates) {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
    if (ok) return true;
  }
  return false;
}
