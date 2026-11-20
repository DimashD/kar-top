import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../push.dart';
import '../widgets/language_picker.dart';
import 'home_screen.dart';
import 'application_screen.dart';
import '../onboarding_l10n.dart';

class StoresScreen extends StatefulWidget {
  const StoresScreen({super.key});
  @override
  State<StoresScreen> createState() => _StoresScreenState();
}

class _StoresScreenState extends State<StoresScreen> {
  late Future<List<StoreSummary>> _future;

  @override
  void initState() {
    super.initState();
    final session = context.read<Session>();
    _future = session.api.myStores();
    // Регистрируем FCM-токен (пуши о заказах) — пользователь уже вошёл.
    PushService.instance.registerToken(session.api);
  }

  void _open(StoreSummary s) {
    // Заявка ещё не одобрена — экран заявки (оттуда можно перейти в магазин и добавлять товары).
    if (s.isApplication && s.myRole == 'OWNER') {
      _apply(s.id);
      return;
    }
    context.read<Session>().selectStore(s);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HomeScreen()));
  }

  Future<void> _apply([String? storeId]) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ApplicationScreen(storeId: storeId)));
    if (mounted) setState(() => _future = context.read<Session>().api.myStores());
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final o = OnbS.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.myStores),
        actions: [
          IconButton(onPressed: () => _apply(), icon: const Icon(Icons.add_business_outlined), tooltip: o.applyCta),
          const LanguageButton(), IconButton(onPressed: () => context.read<Session>().logout(), icon: const Icon(Icons.logout))],
      ),
      body: FutureBuilder<List<StoreSummary>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', style: const TextStyle(color: AppColors.sale))));
          }
          final stores = snap.data ?? [];
          if (stores.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(s.notLinkedToStore, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.ink60)),
                  const SizedBox(height: 8),
                  Text(o.applyHint, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton.icon(onPressed: () => _apply(), icon: const Icon(Icons.add_business_outlined), label: Text(o.applyCta)),
                ]),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: stores.length,
            itemBuilder: (context, i) {
              final st = stores[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: const CircleAvatar(backgroundColor: AppColors.carrot50, child: Icon(Icons.storefront_outlined, color: AppColors.carrot)),
                  title: Text(st.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                  // Роль — на языке интерфейса; статус показываем, только если магазин не активен.
                  subtitle: Row(children: [
                    Text(s.roles[st.myRole] ?? st.myRole, style: const TextStyle(color: AppColors.ink60)),
                    if (st.status != 'ACTIVE') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.sale.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                        child: Text(st.isApplication ? o.applicationChip : (s.storeStatuses[st.status] ?? st.status), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.sale)),
                      ),
                    ],
                  ]),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _open(st),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
