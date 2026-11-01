import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<OrderSummary>> _future;

  // Активные статусы — то, что требует внимания магазина.
  static const _active = ['PLACED', 'ACCEPTED', 'PICKING', 'AWAITING_CUSTOMER', 'READY', 'COURIER_ASSIGNED', 'DELIVERING'];

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
          final active = all.where((o) => _active.contains(o.status)).toList();
          final done = all.where((o) => !_active.contains(o.status)).toList();
          if (all.isEmpty) {
            return ListView(children: const [Padding(padding: EdgeInsets.all(40), child: Center(child: Text('Заказов пока нет', style: TextStyle(color: AppColors.ink60))))]);
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (active.isNotEmpty) const _SectionTitle('Активные'),
              ...active.map(_tile),
              if (done.isNotEmpty) const _SectionTitle('Завершённые'),
              ...done.map(_tile),
            ],
          );
        },
      ),
    );
  }

  Widget _tile(OrderSummary o) {
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
            Text('Заказ №${o.number}', style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: _statusColor(o.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
              child: Text(statusLabel(o.status), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _statusColor(o.status))),
            ),
          ],
        ),
        subtitle: Text('${o.itemCount} поз. · ${tenge(o.amountTiyn)} · ${dateTime(o.createdAt)}', style: const TextStyle(color: AppColors.ink40)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
          if (mounted) setState(_load);
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 10),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.ink40, letterSpacing: 0.4)),
      );
}
