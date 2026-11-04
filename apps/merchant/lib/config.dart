/// Базовый URL API. Переопределяется при сборке:
///   flutter build apk --dart-define=API_BASE=https://kar-top.kz/api
/// (прод: API отдаётся Caddy на том же домене по префиксу /api).
/// По умолчанию — хост-машина для Android-эмулятора (10.0.2.2).
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://10.0.2.2:3000/api',
);

/// Канал OTP по умолчанию (как на бэкенде: telegram → whatsapp → sms).
const String kOtpChannel = 'sms';

/// Окружение сборки: `prod` или `staging` (--dart-define=APP_ENV=staging).
/// В тестовой сборке поверх приложения показывается красная лента «ТЕСТ».
const String kAppEnv = String.fromEnvironment('APP_ENV', defaultValue: 'prod');
bool get kIsStaging => kAppEnv == 'staging';
