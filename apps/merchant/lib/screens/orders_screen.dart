import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../push.dart';
import '../theme.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

/// Фильтры списка заказов (чипы со счётчиками над списком).
enum _Filter { active, fresh, inWork, ready, done, cancelled }

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<OrderSummary>> _future;
  _Filter _filter = _Filter.active;

  // Группы статусов: новые — ждут принятия; в работе — сборка; готовы — к выдаче или в пути.
  static const _fresh = ['PLACED'];
  static const _inWork = ['ACCEPTED', 'PICKING', 'AWAITING_CUSTOMER'];
  static const _ready = ['READY', 'COURIER_ASSIGNED', 'DELIVERING'];
  static const _done = ['DELIVERED', 'COMPLETED'];

  bool _matches(_Filter f, String status) => switch (f) {
        _Filter.active => _fresh.contains(status) || _inWork.contains(status) || _ready.contains(status),
        _Filter.fresh => _fresh.contains(status),
        _Filter.inWork => _inWork.contains(status),
        _Filter.ready => _ready.contains(status),
        _Filter.done => _done.contains(status),
        _Filter.cancelled => status == 'CANCELLED',
      };

  String _filterLabel(S s, _Filter f) => switch (f) {
        _Filter.active => s.activeOrders,
        _Filter.fresh => s.filterNew,
        _Filter.inWork => s.filterInWork,
        _Filter.ready => s.filterReady,
        _Filter.done => s.completedOrders,
        _Filter.cancelled => s.filterCancelled,
      };

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    // Пришёл пуш — сразу обновляем список; плюс тихое обновление раз в 30 с.
    pushTick.addListener(_silentReload);
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _silentReload());
  }

  @override
  void dispose() {
    pushTick.removeListener(_silentReload);
    _timer?.cancel();
    super.dispose();
  }

  void _silentReload() {
    if (mounted) setState(_load);
  }

  void _load() {
    final s = context.read<Session>();
    _future = s.api.orders(s.store!.id);
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  // Свой цвет у каждой группы статусов: новые — морковный, в работе — синий,
  // ждём клиента — янтарный, готовы и в пути — фиолетовый, выданы — зелёный, отменены — серый.
  static const _blue = Color(0xFF2F6FDE);
  static const _amber = Color(0xFFD48A00);
  static const _violet = Color(0xFF7B4FD6);
  Color _statusColor(String s) {
    if (s == 'PLACED') return AppColors.carrot;
    if (s == 'AWAITING_CUSTOMER') return _amber;
    if (_inWork.contains(s)) return _blue;
    if (_ready.contains(s)) return _violet;
    if (_done.contains(s)) return AppColors.leaf;
    return AppColors.ink40;
  }

  /// Порядок в списке: строго по времени — свежие заказы сверху (статус видно по цветной метке и фильтрам).
  static int _compare(OrderSummary a, OrderSummary b) => b.createdAt.compareTo(a.createdAt);

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<OrderSummary>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done && !snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', style: const TextStyle(color: AppColors.sale)))]);
          }
          final all = snap.data ?? [];
          if (all.isEmpty) {
            return ListView(children: [Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.noOrders, style: const TextStyle(color: AppColors.ink60))))]);
          }
          final shown = all.where((o) => _matches(_filter, o.status)).toList()..sort(_compare);
          return Column(
            children: [
              Container(
                color: AppColors.card,
                height: 56,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  children: [
                    for (final f in _Filter.values) _filterChip(s, f, all.where((o) => _matches(f, o.status)).length),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: shown.isEmpty
                    ? ListView(children: [Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.noOrdersHere, style: const TextStyle(color: AppColors.ink60))))])
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: shown.map((o) => _tile(s, o)).toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Чип фильтра; у «Новых» счётчик подсвечен, если есть заказы, которые ждут принятия.
  Widget _filterChip(S s, _Filter f, int count) {
    final selected = _filter == f;
    final urgent = f == _Filter.fresh && count > 0;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        selected: selected,
        showCheckmark: false,
        selectedColor: AppColors.carrot50,
        onSelected: (_) => setState(() => _filter = f),
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_filterLabel(s, f), style: TextStyle(fontWeight: FontWeight.w700, color: selected ? AppColors.carrot600 : AppColors.ink60)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              decoration: BoxDecoration(color: urgent ? AppColors.carrot : AppColors.line, borderRadius: BorderRadius.circular(999)),
              child: Text('$count', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: urgent ? Colors.white : AppColors.ink60)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(S s, OrderSummary o) {
    final isNew = o.status == 'PLACED';
    final color = _statusColor(o.status);
    final muted = o.status == 'CANCELLED';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      color: isNew ? AppColors.carrot50 : AppColors.card,
      child: InkWell(
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
          if (mounted) setState(_load);
        },
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 5, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                  child: Row(
                    children: [
                      Icon(o.fulfillment == 'PICKUP' ? Icons.storefront_outlined : Icons.delivery_dining_outlined,
                          color: muted ? AppColors.ink40 : AppColors.ink60),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(s.orderNo(o.number),
                                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: muted ? AppColors.ink40 : AppColors.ink)),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(999)),
                                    child: Text(statusLabel(s, o.status), maxLines: 1, overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text('${s.positions(o.itemCount)} · ${tenge(o.amountTiyn)}',
                                style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink60)),
                            Text(o.fulfillment == 'PICKUP' && o.pickupAt != null ? s.pickupAt(dateTime(s, o.pickupAt!)) : dateTime(s, o.createdAt),
                                style: const TextStyle(fontSize: 12, color: AppColors.ink40)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: AppColors.ink40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
