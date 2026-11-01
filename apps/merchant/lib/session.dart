import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'models.dart';

/// Состояние сессии: токен (persist) и выбранный магазин.
class Session extends ChangeNotifier {
  final Api api = Api();
  String? _token;
  StoreSummary? store;
  bool loading = true;

  bool get isAuthed => _token != null;

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    api.token = _token;
    loading = false;
    notifyListeners();
  }

  Future<void> setToken(String token) async {
    _token = token;
    api.token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    notifyListeners();
  }

  void selectStore(StoreSummary s) {
    store = s;
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    api.token = null;
    store = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    notifyListeners();
  }
}
