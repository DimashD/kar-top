import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

/// HTTP-клиент к API Kartop. Хранит access-токен (живёт 15 мин) и refresh-токен (30 дней):
/// на ответ 401 сам продлевает вход и повторяет запрос; не вышло — [onAuthLost] (экран входа).
class Api {
  String? token;
  String? refreshToken;
  /// Новые токены после продления — сессия сохраняет их.
  Future<void> Function(String access, String refresh)? onTokens;
  /// Продлить вход не удалось (refresh истёк/отозван) — сессия выходит на экран входа.
  Future<void> Function()? onAuthLost;
  Future<bool>? _refreshing;

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Uri _u(String path) => Uri.parse('$kApiBase$path');

  dynamic _decode(http.Response r) {
    final body = r.body.isEmpty ? null : jsonDecode(r.body);
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final msg = body is Map && body['message'] != null
        ? (body['message'] is List ? (body['message'] as List).first.toString() : body['message'].toString())
        : 'Ошибка ${r.statusCode}';
    throw ApiException(msg, r.statusCode);
  }

  /// Запрос с авто-продлением входа: 401 → refresh → повтор один раз.
  Future<dynamic> _send(String path, Future<http.Response> Function() call) async {
    var r = await call();
    if (r.statusCode == 401 && refreshToken != null && !path.startsWith('/auth/')) {
      if (await _refresh()) {
        r = await call();
      } else {
        await onAuthLost?.call();
      }
    }
    return _decode(r);
  }

  /// Продление входа; параллельные запросы ждут одно и то же продление.
  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final r = await http.post(_u('/auth/otp/refresh'), headers: {'content-type': 'application/json'}, body: jsonEncode({'refreshToken': refreshToken}));
        if (r.statusCode < 200 || r.statusCode >= 300) return false;
        final j = jsonDecode(r.body) as Map<String, dynamic>;
        token = j['accessToken'] as String;
        refreshToken = j['refreshToken'] as String? ?? refreshToken;
        await onTokens?.call(token!, refreshToken!);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> _get(String path) => _send(path, () => http.get(_u(path), headers: _headers));
  Future<dynamic> _post(String path, [Map<String, dynamic>? body]) =>
      _send(path, () => http.post(_u(path), headers: _headers, body: jsonEncode(body ?? {})));
  Future<dynamic> _put(String path, Map<String, dynamic> body) =>
      _send(path, () => http.put(_u(path), headers: _headers, body: jsonEncode(body)));
  Future<dynamic> _patch(String path, Map<String, dynamic> body) =>
      _send(path, () => http.patch(_u(path), headers: _headers, body: jsonEncode(body)));
  Future<dynamic> _delete(String path) => _send(path, () => http.delete(_u(path), headers: _headers));

  // --- Auth ---
  Future<void> requestOtp(String phone) => _post('/auth/otp/request', {'phone': phone, 'channel': kOtpChannel});

  /// Заявка «Стать партнёром» (публичная, без авторизации). Телефон и имя обязательны.
  Future<void> applyPartner({required String name, required String phone, String? company, String? twogisUrl}) =>
      _post('/partners/apply', {
        'name': name,
        'phone': phone,
        if (company != null && company.isNotEmpty) 'company': company,
        if (twogisUrl != null && twogisUrl.isNotEmpty) 'twogisUrl': twogisUrl,
        'source': 'merchant_app',
      });

  /// Привязка email (телефон уже подтверждён): шаг 1 — код на почту, шаг 2 — подтверждение.
  Future<void> requestEmailCode(String email) => _post('/auth/email/request', {'email': email});
  Future<void> verifyEmailCode(String code) => _post('/auth/email/verify', {'code': code});
  /// Вход по коду: (access-токен, refresh-токен).
  Future<(String, String?)> verifyOtp(String phone, String code) async {
    final r = await _post('/auth/otp/verify', {'phone': phone, 'code': code}) as Map<String, dynamic>;
    return (r['accessToken'] as String, r['refreshToken'] as String?);
  }

  /// Вход по номеру и паролю: (access, refresh).
  Future<(String, String?)> loginPassword(String phone, String password) async {
    final r = await _post('/auth/password/login', {'phone': phone, 'password': password}) as Map<String, dynamic>;
    return (r['accessToken'] as String, r['refreshToken'] as String?);
  }

  /// Придумать/сменить пароль (уже вошли).
  Future<void> setPassword(String password) => _post('/me/password', {'password': password});

  // --- Сотрудники магазина ---
  Future<List<StoreMemberInfo>> members(String storeId) async =>
      ((await _get('/merchant/stores/$storeId/members')) as List).map((j) => StoreMemberInfo.fromJson(j as Map<String, dynamic>)).toList();
  Future<List<StoreMemberInfo>> addMember(String storeId, String phone, String role, String? name) async =>
      ((await _post('/merchant/stores/$storeId/members', {'phone': phone, 'role': role, if (name != null && name.isNotEmpty) 'name': name})) as List)
          .map((j) => StoreMemberInfo.fromJson(j as Map<String, dynamic>)).toList();
  Future<List<StoreMemberInfo>> updateMember(String storeId, String userId, String role) async =>
      ((await _patch('/merchant/stores/$storeId/members/$userId', {'role': role})) as List)
          .map((j) => StoreMemberInfo.fromJson(j as Map<String, dynamic>)).toList();
  Future<List<StoreMemberInfo>> removeMember(String storeId, String userId) async =>
      ((await _delete('/merchant/stores/$storeId/members/$userId')) as List)
          .map((j) => StoreMemberInfo.fromJson(j as Map<String, dynamic>)).toList();

  /// Есть ли у пользователя пароль.
  Future<bool> hasPassword() async => ((await _get('/me')) as Map<String, dynamic>)['hasPassword'] == true;

  // --- Stores ---
  Future<List<StoreSummary>> myStores() async {
    final r = await _get('/merchant/stores') as List;
    return r.map((e) => StoreSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<StoreSettings> settings(String storeId) async =>
      StoreSettings.fromJson(await _get('/merchant/stores/$storeId/settings') as Map<String, dynamic>);

  Future<StoreSettings> updateSettings(String storeId, Map<String, dynamic> body) async =>
      StoreSettings.fromJson(await _patch('/merchant/stores/$storeId/settings', body) as Map<String, dynamic>);

  // --- Orders ---
  /// Центр уведомлений: последние 50 и число непрочитанных.
  Future<(int, List<AppNotification>)> notifications() async {
    final r = await _get('/me/notifications?app=merchant') as Map<String, dynamic>;
    final items = (r['items'] as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
    return ((r['unread'] as num?)?.toInt() ?? 0, items);
  }

  Future<void> readNotifications() => _post('/me/notifications/read?app=merchant');

  Future<List<OrderSummary>> orders(String storeId, {String? status}) async {
    final q = status != null ? '?status=$status' : '';
    final r = await _get('/merchant/stores/$storeId/orders$q') as List;
    return r.map((e) => OrderSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<OrderDetail> order(String id) async =>
      OrderDetail.fromJson(await _get('/merchant/orders/$id') as Map<String, dynamic>);

  Future<void> transition(String id, String action) => _post('/merchant/orders/$id/$action');
  /// customerApproved — вес вне допуска согласован с покупателем.
  Future<void> weigh(String id, String itemId, int qtyActualG, {bool customerApproved = false}) =>
      _post('/merchant/orders/$id/items/$itemId/weigh', {'qtyActualG': qtyActualG, if (customerApproved) 'customerApproved': true});
  Future<void> awaitCustomer(String id) => _post('/merchant/orders/$id/await-customer');
  Future<void> markMissing(String id, String itemId) => _post('/merchant/orders/$id/items/$itemId/missing');
  Future<void> restoreItem(String id, String itemId) => _post('/merchant/orders/$id/items/$itemId/restore');
  Future<void> delivering(String id) => _post('/courier/orders/$id/delivering');
  Future<void> delivered(String id, String code) => _post('/courier/orders/$id/delivered', {'code': code});

  // --- Зоны доставки ---
  Future<Map<String, dynamic>> zones(String storeId) async => await _get('/merchant/stores/$storeId/zones') as Map<String, dynamic>;
  /// Обратная связь команде Kartop: kind — PROBLEM | IDEA | OTHER.
  Future<void> sendFeedback(String storeId, String kind, String text) =>
      _post('/merchant/feedback', {'storeId': storeId, 'kind': kind, 'text': text});

  /// Фото магазина (JPEG base64); null — убрать. Возвращает новую версию фото.
  Future<int?> setStorePhoto(String storeId, String? base64Jpeg) async {
    final r = await _put('/merchant/stores/$storeId/photo', {'data': base64Jpeg, 'type': 'image/jpeg'});
    return ((r as Map<String, dynamic>)['photoVersion'] as num?)?.toInt();
  }

  Future<void> saveZones(String storeId, Map<String, dynamic> body) => _put('/merchant/stores/$storeId/zones', body);

  // --- Push ---
  Future<void> registerPushToken(String platform, String token) =>
      _post('/devices/push-token', {'platform': platform, 'token': token, 'app': 'merchant'});

  // --- Catalog ---
  Future<List<CatalogItem>> catalog(String storeId) async {
    final r = await _get('/merchant/stores/$storeId/catalog') as Map<String, dynamic>;
    return (r['items'] as List).map((e) => CatalogItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> updateProduct(String storeId, String spId, Map<String, dynamic> body) =>
      _patch('/merchant/stores/$storeId/products/$spId', body);

  // --- Заявки на каталог ---
  Future<void> submitCatalogRequest(String storeId, Map<String, dynamic> body) =>
      _post('/merchant/stores/$storeId/catalog-requests', body);

  Future<List<Map<String, dynamic>>> myCatalogRequests(String storeId) async {
    final r = await _get('/merchant/stores/$storeId/catalog-requests') as List;
    return r.cast<Map<String, dynamic>>();
  }
}
