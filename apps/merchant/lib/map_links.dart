import 'package:url_launcher/url_launcher.dart';

enum MapApp { dgis, yandex, google }

/// Маршрут до клиента в выбранном приложении карт: сначала само приложение, затем его сайт.
/// Есть точка — маршрут к ней; нет — поиск по адресу. Возвращает false, если не открылось ничего.
Future<bool> openRoute(MapApp app, {double? lat, double? lng, String? address}) async {
  final hasPoint = lat != null && lng != null;
  final q = Uri.encodeComponent(address ?? '');
  if (!hasPoint && q.isEmpty) return false;
  final candidates = switch (app) {
    // 2ГИС принимает координаты в порядке «долгота,широта».
    MapApp.dgis => hasPoint
        ? ['dgis://2gis.ru/routeSearch/rsType/car/to/$lng,$lat', 'https://2gis.kz/directions/points/%7C$lng%2C$lat']
        : ['dgis://2gis.ru/search/$q', 'https://2gis.kz/search/$q'],
    MapApp.yandex => hasPoint
        ? ['yandexmaps://maps.yandex.ru/?rtext=~$lat,$lng&rtt=auto', 'https://yandex.kz/maps/?rtext=~$lat%2C$lng&rtt=auto']
        : ['yandexmaps://maps.yandex.ru/?text=$q', 'https://yandex.kz/maps/?text=$q'],
    MapApp.google => hasPoint
        ? ['https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving']
        : ['https://www.google.com/maps/dir/?api=1&destination=$q&travelmode=driving'],
  };
  for (final u in candidates) {
    final ok = await launchUrl(Uri.parse(u), mode: LaunchMode.externalApplication).catchError((_) => false);
    if (ok) return true;
  }
  return false;
}
