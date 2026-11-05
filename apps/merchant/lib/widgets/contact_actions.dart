import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n.dart';
import '../theme.dart';

/// Связь с клиентом (после принятия заказа): звонок через сотовую связь, копирование номера, WhatsApp.
class ContactActions extends StatelessWidget {
  final String phone;
  const ContactActions({super.key, required this.phone});

  /// Только цифры: +7 701 123 45 67 → 77011234567 (формат wa.me).
  String get _digits => phone.replaceAll(RegExp(r'\D'), '');

  Future<void> _open(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final s = context.read<Lang>().s;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
    if (!ok) messenger.showSnackBar(SnackBar(content: Text(s.cannotOpen)));
  }

  Future<void> _copy(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final s = context.read<Lang>().s;
    await Clipboard.setData(ClipboardData(text: phone));
    messenger.showSnackBar(SnackBar(content: Text(s.phoneCopied)));
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: AppColors.leaf),
            onPressed: () => _open(context, Uri(scheme: 'tel', path: '+$_digits')),
            icon: const Icon(Icons.call, size: 18),
            label: Text(s.callCustomer),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
            onPressed: () => _open(context, Uri.parse('https://wa.me/$_digits')),
            icon: const Icon(Icons.chat, size: 18),
            label: Text(s.whatsapp),
          ),
          OutlinedButton.icon(
            onPressed: () => _copy(context),
            icon: const Icon(Icons.copy, size: 18),
            label: Text(s.copyPhone),
          ),
        ],
      ),
    );
  }
}
