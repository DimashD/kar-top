import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n.dart';
import '../phone.dart';
import '../theme.dart';

const _whatsappGreen = Color(0xFF1FA855);

/// Связь с клиентом (после принятия заказа): звонок через сотовую связь, WhatsApp, копирование номера.
/// Три одинаковые плитки «иконка + подпись» в ряд.
class ContactActions extends StatelessWidget {
  final String phone;
  const ContactActions({super.key, required this.phone});

  Future<void> _open(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final s = context.read<Lang>().s;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
    if (!ok) messenger.showSnackBar(SnackBar(content: Text(s.cannotOpen)));
  }

  Future<void> _copy(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final s = context.read<Lang>().s;
    await Clipboard.setData(ClipboardData(text: formatKzPhone(phone)));
    messenger.showSnackBar(SnackBar(content: Text(s.phoneCopied)));
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final digits = kzDigits(phone);
    return Row(
      children: [
        _Tile(icon: Icons.call, label: s.callCustomer, color: AppColors.leaf,
            onTap: () => _open(context, Uri(scheme: 'tel', path: '+$digits'))),
        const SizedBox(width: 8),
        _Tile(icon: Icons.chat_bubble, label: s.whatsapp, color: _whatsappGreen,
            onTap: () => _open(context, Uri.parse('https://wa.me/$digits'))),
        const SizedBox(width: 8),
        _Tile(icon: Icons.copy_rounded, label: s.copyPhone, color: AppColors.ink60, onTap: () => _copy(context)),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _Tile({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: color.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            child: Column(
              children: [
                Icon(icon, color: color, size: 24),
                const SizedBox(height: 6),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
