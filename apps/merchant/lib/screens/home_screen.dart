import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../session.dart';
import '../widgets/kartop_logo.dart';
import '../push.dart';
import '../widgets/share_store.dart';
import 'orders_screen.dart';
import 'catalog_screen.dart';
import 'settings_screen.dart';
import 'notifications_screen.dart';
import 'contract_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  // Документы: сотрудник не дал согласие на ПДн — экран согласия; владелец не принял оферту — экран договора.
  // Нет связи — не блокируем работу, спросим при следующем входе.
  bool _needConsent = false;
  bool _needOffer = false;

  @override
  void initState() {
    super.initState();
    // Магазин выбран — открываем заказ из уведомления, если на него нажали до входа.
    PushService.instance.openPending();
    _checkLegal();
  }

  Future<void> _checkLegal() async {
    final session = context.read<Session>();
    final store = session.store;
    try {
      final me = await session.api.legalStatus();
      final consent = me['terms'] != true || me['pdConsent'] != true;
      var offer = false;
      if (store != null && store.myRole == 'OWNER') {
        offer = (await session.api.offerStatus(store.id))['accepted'] != true;
      }
      if (mounted) setState(() { _needConsent = consent; _needOffer = offer; });
    } catch (_) {/* нет связи — спросим позже */}
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final store = context.watch<Session>().store;
    final pages = const [OrdersScreen(), CatalogScreen(), SettingsScreen()];
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          const KartopLogo(size: 22, showWord: false),
          const SizedBox(width: 10),
          Flexible(child: Text(store?.name ?? s.store, overflow: TextOverflow.ellipsis)),
        ]),
        actions: [
          const NotificationBell(),
          if (store != null)
            IconButton(
              onPressed: () => shareStore(context, store),
              icon: const Icon(Icons.ios_share),
              tooltip: s.shareStore,
            ),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.swap_horiz),
            tooltip: s.switchStore,
          ),
        ],
      ),
      body: _needConsent
          ? ConsentView(onDone: () => setState(() => _needConsent = false))
          : _needOffer && store != null
              ? ContractView(storeId: store.id, onDone: () => setState(() => _needOffer = false))
              : IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: _needConsent || _needOffer ? null : NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.receipt_long_outlined), selectedIcon: const Icon(Icons.receipt_long), label: s.tabOrders),
          NavigationDestination(icon: const Icon(Icons.storefront_outlined), selectedIcon: const Icon(Icons.storefront), label: s.tabProducts),
          NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: s.tabSettings),
        ],
      ),
    );
  }
}
