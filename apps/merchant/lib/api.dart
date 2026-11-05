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

/// HTTP-клиент к API Kartop. Хранит access-токен, подставляет заголовок авторизации.
class Api {
  String? token;

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

  Future<dynamic> _get(String path) async => _decode(await http.get(_u(path), headers: _headers));
  Future<dynamic> _post(String path, [Map<String, dynamic>? body]) async =>
      _decode(await http.post(_u(path), headers: _headers, body: jsonEncode(body ?? {})));
  Future<dynamic> _patch(String path, Map<String, dynamic> body) async =>
      _decode(await http.patch(_u(path), headers: _headers, body: jsonEncode(body)));

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
  Future<String> verifyOtp(String phone, String code) async {
    final r = await _post('/auth/otp/verify', {'phone': phone, 'code': code});
    return (r as Map<String, dynamic>)['accessToken'] as String;
  }

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

  // --- Push ---
  Future<void> registerPushToken(String platform, String token) =>
      _post('/devices/push-token', {'platform': platform, 'token': token});

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
