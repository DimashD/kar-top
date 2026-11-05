import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../theme.dart';

/// Первый запуск: выбор языка интерфейса до входа. Вопрос — сразу на казахском и русском,
/// казахский в списке первым.
class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const Text('Kartop', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.carrot)),
              const SizedBox(height: 16),
              const Text('Тілді таңдаңыз', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              const Text('Выберите язык', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.ink60)),
              const SizedBox(height: 24),
              for (final code in Lang.supported) ...[
                SizedBox(
                  height: 56,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      side: BorderSide(color: code == lang.code ? AppColors.carrot : AppColors.line, width: code == lang.code ? 2 : 1),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () => lang.set(code),
                    child: Text(S.names[code]!, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink)),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}
