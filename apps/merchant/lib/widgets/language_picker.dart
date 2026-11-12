import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../theme.dart';

/// Выбор языка интерфейса: нижняя шторка со списком языков.
Future<void> showLanguagePicker(BuildContext context) {
  final lang = context.read<Lang>();
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final code in Lang.supported)
            ListTile(
              title: Text(S.names[code]!, style: const TextStyle(fontWeight: FontWeight.w700)),
              trailing: code == lang.code ? const Icon(Icons.check, color: AppColors.carrot) : null,
              onTap: () {
                lang.set(code);
                Navigator.pop(ctx);
              },
            ),
        ],
      ),
    ),
  );
}

/// Кнопка с текущим языком (для экрана входа и шапки).
class LanguageButton extends StatelessWidget {
  const LanguageButton({super.key});
  @override
  Widget build(BuildContext context) {
    final code = context.watch<Lang>().code;
    return TextButton.icon(
      onPressed: () => showLanguagePicker(context),
      icon: const Icon(Icons.language, size: 20),
      label: Text(S.names[code]!),
    );
  }
}
