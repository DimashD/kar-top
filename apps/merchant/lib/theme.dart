import 'package:material_ui/material_ui.dart';

/// Тёплая палитра «Морковь» — как в вебе и макетах.
class AppColors {
  static const carrot = Color(0xFFD9531E);
  static const carrot600 = Color(0xFFBE4414);
  static const carrot50 = Color(0xFFFCEDE6);
  static const leaf = Color(0xFF3E7C4F);
  static const leaf50 = Color(0xFFE9F2EB);
  static const ink = Color(0xFF1A1512);
  static const ink60 = Color(0xFF6B5F57);
  static const ink40 = Color(0xFF9A8F88);
  static const line = Color(0xFFECE6E1);
  static const bg = Color(0xFFFBF8F5);
  static const card = Color(0xFFFFFFFF);
  static const sale = Color(0xFFC0392B);
}

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.carrot,
      secondary: AppColors.leaf,
      surface: AppColors.card,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.card,
      foregroundColor: AppColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: AppColors.ink, fontSize: 19, fontWeight: FontWeight.w800),
    ),
    cardTheme: CardThemeData(
      color: AppColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.line),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.carrot,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.line),
      ),
    ),
  );
}
