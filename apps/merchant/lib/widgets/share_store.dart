import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../config.dart';
import '../l10n.dart';
import '../models.dart';
import '../theme.dart';

/// Отправить покупателю ссылку на витрину магазина (WhatsApp, Telegram, SMS — системное меню «Поделиться»).
Future<void> shareStore(BuildContext context, StoreSummary store) {
  final s = context.read<Lang>().s;
  return Share.share(s.shareText(store.name, storefrontUrl(store.slug)), subject: store.name);
}

/// Карточка в настройках: ссылка на витрину + «Поделиться» и «Копировать».
class StoreLinkCard extends StatelessWidget {
  final StoreSummary store;
  const StoreLinkCard({super.key, required this.store});

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final url = storefrontUrl(store.slug);
    return Card(
      color: AppColors.carrot50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(s.storeLink, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.carrot600, letterSpacing: 0.4)),
            const SizedBox(height: 6),
            SelectableText(url, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => shareStore(context, store),
                    icon: const Icon(Icons.ios_share),
                    label: Text(s.shareStore),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.outlined(
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    await Clipboard.setData(ClipboardData(text: url));
                    messenger.showSnackBar(SnackBar(content: Text(s.linkCopied)));
                  },
                  icon: const Icon(Icons.copy_rounded),
                  tooltip: s.copyPhone,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
