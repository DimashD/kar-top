import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../session.dart';
import '../push.dart';
import '../widgets/share_store.dart';
import 'orders_screen.dart';
import 'catalog_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    // Магазин выбран — открываем заказ из уведомления, если на него нажали до входа.
    PushService.instance.openPending();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final store = context.watch<Session>().store;
    final pages = const [OrdersScreen(), CatalogScreen(), SettingsScreen()];
    return Scaffold(
      appBar: AppBar(
        title: Text(store?.name ?? s.store),
        actions: [
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
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
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
