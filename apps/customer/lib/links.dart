/// Адрес сайта-витрины. Сборка: --dart-define=WEB_BASE=https://test.kar-top.kz (тестовое приложение).
const String kWebBase = String.fromEnvironment('WEB_BASE', defaultValue: 'https://kar-top.kz');

/// Ссылка, которую открываем внутри приложения (наш сайт), а не во внешнем приложении.
bool isOwnPage(Uri uri, {String base = kWebBase}) {
  final b = Uri.parse(base);
  return (uri.scheme == 'https' || uri.scheme == 'http') && uri.host == b.host;
}

/// Диплинк → адрес страницы витрины:
///   kartop://order/<id>  → <base>/order/<id>
///   https://<наш хост>/… → как есть.
/// null — ссылка не наша.
Uri? pageForLink(Uri link, {String base = kWebBase}) {
  if (link.scheme == 'kartop') {
    final parts = [if (link.host.isNotEmpty) link.host, ...link.pathSegments];
    return Uri.parse('$base/${parts.join('/')}');
  }
  return isOwnPage(link, base: base) ? link : null;
}

/// Страница витрины магазина (kar-top.kz/<slug>) — её запоминаем, чтобы открывать при следующем запуске.
String? shopSlugOf(Uri uri, {String base = kWebBase}) {
  if (!isOwnPage(uri, base: base) || uri.pathSegments.length != 1) return null;
  const reserved = {'app', 'partner', 'privacy', 'terms', 'delete-account', 'admin'};
  final slug = uri.pathSegments.first;
  return slug.isEmpty || reserved.contains(slug) ? null : slug;
}
