import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'models.dart';
import 'push.dart' show navigatorKey;

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
    api.refreshToken = prefs.getString('refresh');
    // Вход продлевается сам; если продлить нельзя — на экран входа.
    api.onTokens = (access, refresh) async {
      _token = access;
      final p = await SharedPreferences.getInstance();
      await p.setString('token', access);
      await p.setString('refresh', refresh);
    };
    api.onAuthLost = () async {
      // Закрываем открытые экраны (заказ, магазин) — корень покажет экран входа.
      navigatorKey.currentState?.popUntil((r) => r.isFirst);
      await logout();
    };
    loading = false;
    notifyListeners();
  }

  Future<void> setToken(String token, [String? refresh]) async {
    _token = token;
    api.token = token;
    api.refreshToken = refresh;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    if (refresh != null) {
      await prefs.setString('refresh', refresh);
    } else {
      await prefs.remove('refresh');
    }
    notifyListeners();
  }

  void selectStore(StoreSummary s) {
    store = s;
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    api.token = null;
    api.refreshToken = null;
    store = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('refresh');
    notifyListeners();
  }
}
