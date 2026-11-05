import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final s = context.read<Session>();
    _future = s.api.orders(s.store!.id);
  }

  Future<void> _refresh() async {
    setState(_load);
    await _future;
  }

  Color _statusColor(String s) {
    if (s == 'PLACED') return AppColors.carrot;
    if (s == 'DELIVERED' || s == 'COMPLETED') return AppColors.leaf;
    if (s == 'CANCELLED') return AppColors.ink40;
    return AppColors.ink60;
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<OrderSummary>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', style: const TextStyle(color: AppColors.sale)))]);
          }
          final all = snap.data ?? [];
          if (all.isEmpty) {
            return ListView(children: [Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.noOrders, style: const TextStyle(color: AppColors.ink60))))]);
          }
          final shown = all.where((o) => _matches(_filter, o.status)).toList();
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
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: isNew ? AppColors.carrot50 : AppColors.bg,
          child: Text(o.fulfillment == 'PICKUP' ? '🛍️' : '🚗'),
        ),
        title: Row(
          children: [
            Text(s.orderNo(o.number), style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: _statusColor(o.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
              child: Text(statusLabel(s, o.status), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _statusColor(o.status))),
            ),
          ],
        ),
        subtitle: Text('${s.positions(o.itemCount)} · ${tenge(o.amountTiyn)} · ${dateTime(s, o.createdAt)}', style: const TextStyle(color: AppColors.ink40)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
          if (mounted) setState(_load);
        },
      ),
    );
  }
}
