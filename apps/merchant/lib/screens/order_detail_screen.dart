import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'courier_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderDetail? _order;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final o = await context.read<Session>().api.order(widget.orderId);
      setState(() { _order = o; _error = null; });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _do(Future<void> Function() action) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await action();
      await _load();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _weighDialog(OrderItem item) async {
    final s = context.read<Session>();
    final ctrl = TextEditingController(text: (item.qtyActualG ?? item.qtyRequestedG ?? 0).toString());
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Взвесить: ${item.name}'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(suffixText: 'г', hintText: 'Фактический вес'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)), child: const Text('Сохранить')),
        ],
      ),
    );
    if (result != null && result > 0) {
      await _do(() => s.api.weigh(widget.orderId, item.id, result));
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: Text(o != null ? 'Заказ №${o.number}' : 'Заказ')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : o == null
              ? Center(child: Text(_error ?? 'Ошибка', style: const TextStyle(color: AppColors.sale)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _statusChip(o.status),
                    const SizedBox(height: 12),
                    _customerCard(o),
                    const SizedBox(height: 12),
                    _itemsCard(o),
                    const SizedBox(height: 12),
                    _payCard(o),
                  ],
                ),
      bottomNavigationBar: o == null ? null : _actions(o),
    );
  }

  Widget _statusChip(String status) => Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: AppColors.carrot50, borderRadius: BorderRadius.circular(999)),
          child: Text(statusLabel(status), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.carrot600)),
        ),
      );

  Widget _customerCard(OrderDetail o) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(o.fulfillment == 'PICKUP' ? 'Самовывоз' : 'Доставка', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            if (!o.piiVisible)
              const Text('Данные клиента откроются после принятия заказа', style: TextStyle(color: AppColors.ink40))
            else ...[
              Text(o.customerName ?? '—', style: const TextStyle(fontWeight: FontWeight.w700)),
              if (o.customerPhone != null) Text(o.customerPhone!, style: const TextStyle(color: AppColors.ink60)),
              if (o.fulfillment == 'DELIVERY' && o.addressLine != null) Text(o.addressLine!, style: const TextStyle(color: AppColors.ink60)),
              if (o.fulfillment == 'PICKUP' && o.pickupAt != null) Text('Самовывоз: ${dateTime(o.pickupAt!)}', style: const TextStyle(color: AppColors.ink60)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _itemsCard(OrderDetail o) {
    final canPick = o.status == 'PICKING';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Состав заказа', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            ...o.items.map((it) {
              final missing = it.status == 'missing';
              final qty = it.weighted
                  ? grams(it.qtyActualG ?? it.qtyRequestedG ?? 0)
                  : '${it.qtyRequested ?? 1} шт';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(it.name, style: TextStyle(fontWeight: FontWeight.w600, decoration: missing ? TextDecoration.lineThrough : null, color: missing ? AppColors.ink40 : AppColors.ink)),
                          Text('$qty${it.weighted && it.qtyActualG == null ? ' · нужно взвесить' : ''}', style: const TextStyle(color: AppColors.ink40, fontSize: 13)),
                        ],
                      ),
                    ),
                    if (canPick && !missing) ...[
                      if (it.weighted)
                        IconButton(onPressed: _busy ? null : () => _weighDialog(it), icon: const Icon(Icons.scale, color: AppColors.carrot)),
                      IconButton(
                        onPressed: _busy ? null : () => _do(() => context.read<Session>().api.markMissing(widget.orderId, it.id)),
                        icon: const Icon(Icons.remove_circle_outline, color: AppColors.sale),
                        tooltip: 'Нет в наличии',
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _payCard(OrderDetail o) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Оплата при получении', style: TextStyle(color: AppColors.ink60)),
                  Text(payLabel(o.payMethod), style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
              Text(tenge(o.finalTiyn ?? o.subtotalTiyn), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.carrot600)),
            ],
          ),
        ),
      );

  Widget? _actions(OrderDetail o) {
    final s = context.read<Session>();
    Widget bar(Widget child) => SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: child));

    switch (o.status) {
      case 'PLACED':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => s.api.transition(o.id, 'accept')), child: const Text('Принять заказ')));
      case 'ACCEPTED':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => s.api.transition(o.id, 'picking')), child: const Text('Начать сборку')));
      case 'PICKING':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => s.api.transition(o.id, 'ready')), child: const Text('Собрано, готово')));
      case 'READY':
        return bar(ElevatedButton(
          onPressed: _busy ? null : () => _do(() => s.api.delivering(o.id)),
          child: Text(o.fulfillment == 'PICKUP' ? 'К выдаче' : 'Передать в доставку'),
        ));
      case 'DELIVERING':
        return bar(ElevatedButton(
          onPressed: _busy
              ? null
              : () async {
                  final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(
                    builder: (_) => CourierScreen(order: o),
                  ));
                  if (ok == true) await _load();
                },
          child: const Text('Подтвердить выдачу по коду'),
        ));
      default:
        return null;
    }
  }
}
