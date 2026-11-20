import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config.dart';
import '../l10n.dart';
import '../models.dart';
import '../onboarding_l10n.dart';
import '../session.dart';
import '../theme.dart';

/// Баннер «С 1 марта меняются тарифы» — пока новый тариф не вступил в силу. Можно скрыть (для этого тарифа).
class TariffBanner extends StatefulWidget {
  const TariffBanner({super.key});
  @override
  State<TariffBanner> createState() => _TariffBannerState();
}

class _TariffBannerState extends State<TariffBanner> {
  static const _kHidden = 'tariffBannerHidden';
  Tariff? _t;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<Session>().api.upcomingTariffs();
      if (list.isEmpty) return;
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getString(_kHidden) == list.first.id) return;
      if (mounted) setState(() => _t = list.first);
    } catch (_) {/* нет связи — покажем в другой раз */}
  }

  Future<void> _hide() async {
    final id = _t?.id;
    setState(() => _t = null);
    if (id != null) (await SharedPreferences.getInstance()).setString(_kHidden, id);
  }

  @override
  Widget build(BuildContext context) {
    final t = _t;
    if (t == null) return const SizedBox.shrink();
    final o = OnbS.of(context);
    final date = DateFormat.yMMMMd(S.of(context).dateLocale).format(t.effectiveFrom);
    return Material(
      color: AppColors.carrot50,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
        child: Row(children: [
          const Icon(Icons.description_outlined, color: AppColors.carrot600),
          const SizedBox(width: 10),
          Expanded(child: Text(o.tariffBanner.replaceAll('{date}', date), style: const TextStyle(fontWeight: FontWeight.w700))),
          TextButton(
            onPressed: () => launchUrl(Uri.parse('$kWebBase/tariffs'), mode: LaunchMode.externalApplication).catchError((_) => false),
            child: Text(o.details),
          ),
          IconButton(onPressed: _hide, icon: const Icon(Icons.close, size: 18)),
        ]),
      ),
    );
  }
}
