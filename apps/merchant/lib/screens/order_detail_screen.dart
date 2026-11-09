import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import 'package:flutter/services.dart';
import '../l10n.dart';
import '../map_links.dart';
import '../phone.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../weight.dart';
import '../widgets/contact_actions.dart';
import '../widgets/delivery_map.dart';
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

  /// Взвешивание: заказанный вес и допуск, поле для фактического, быстрые кнопки, сумма на лету.
  /// Вне допуска «Сохранить» недоступно — только «Позвонить клиенту», «Клиент согласен» или пауза.
  Future<void> _weighDialog(OrderItem item) async {
    final session = context.read<Session>();
    final s = context.read<Lang>().s;
    final order = _order;
    final requested = item.qtyRequestedG ?? 0;
    final range = weightRange(requested);
    final ctrl = TextEditingController(text: (item.qtyActualG ?? requested).toString());
    // null — закрыли; (вес, согласие клиента); вес −1 — поставить заказ на паузу.
    final result = await showModalBottomSheet<(int, bool)>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final g = int.tryParse(ctrl.text) ?? 0;
          final inRange = g >= range.minG && g <= range.maxG;
          void setG(int v) {
            ctrl.text = '${v < 0 ? 0 : v}';
            setSheet(() {});
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(item.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${s.ordered(grams(s, requested))} · ${s.perKgPrice(tenge(item.priceSnapTiyn))}',
                    style: const TextStyle(color: AppColors.ink60)),
                Text(s.allowedRange(grams(s, range.minG), grams(s, range.maxG)),
                    style: const TextStyle(color: AppColors.ink60, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                TextField(
                  controller: ctrl,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: inRange ? AppColors.ink : AppColors.sale),
                  decoration: InputDecoration(labelText: s.weightGrams, suffixText: s.unitG),
                  onChanged: (_) => setSheet(() {}),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (final d in const [-50, -10, 10, 50]) ...[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setG(g + d),
                          child: Text(d > 0 ? '+$d' : '$d'),
                        ),
                      ),
                      if (d != 50) const SizedBox(width: 6),
                    ],
                  ],
                ),
                const SizedBox(height: 14),
                Text(s.sumPreview(tenge((item.priceSnapTiyn * g / 1000).round())),
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                const SizedBox(height: 14),
                if (inRange || g <= 0)
                  ElevatedButton(
                    onPressed: g > 0 ? () => Navigator.pop(ctx, (g, false)) : null,
                    child: Text(s.save),
                  )
                else ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.sale.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                    child: Text(s.outOfRange, style: const TextStyle(color: AppColors.sale, fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(height: 10),
                  if (order?.customerPhone != null) ...[
                    ContactActions(phone: order!.customerPhone!),
                    const SizedBox(height: 10),
                  ],
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, (g, true)),
                    child: Text(s.customerAgreed),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.pop(ctx, (-1, false)),
                    icon: const Icon(Icons.pause_circle_outline),
                    label: Text(s.waitCustomer),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
    if (result == null) return;
    final (g, approved) = result;
    if (g == -1) {
      await _do(() => session.api.awaitCustomer(widget.orderId));
    } else if (g > 0) {
      await _do(() => session.api.weigh(widget.orderId, item.id, g, customerApproved: approved));
    }
  }

  /// Маршрут: выбор приложения карт (2ГИС, Яндекс, Google) и «Копировать адрес».
  Future<void> _route(OrderDetail o) async {
    final s = context.read<Lang>().s;
    final messenger = ScaffoldMessenger.of(context);
    Future<void> go(BuildContext ctx, MapApp app) async {
      Navigator.pop(ctx);
      final ok = await openRoute(app, lat: o.lat, lng: o.lng, address: o.addressLine);
      if (!ok) messenger.showSnackBar(SnackBar(content: Text(s.cannotOpen)));
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(s.routeIn, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ),
              if (o.addressLine != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Text(o.addressLine!, style: const TextStyle(color: AppColors.ink60)),
                ),
              ListTile(leading: const Icon(Icons.map_outlined, color: AppColors.leaf), title: const Text('2ГИС'), onTap: () => go(ctx, MapApp.dgis)),
              ListTile(leading: const Icon(Icons.map_outlined, color: AppColors.sale), title: Text(s.yandexMaps), onTap: () => go(ctx, MapApp.yandex)),
              ListTile(leading: const Icon(Icons.map_outlined, color: Color(0xFF2F6FDE)), title: const Text('Google Maps'), onTap: () => go(ctx, MapApp.google)),
              if (o.addressLine != null)
                ListTile(
                  leading: const Icon(Icons.copy_rounded, color: AppColors.ink60),
                  title: Text(s.copyAddress),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await Clipboard.setData(ClipboardData(text: o.addressLine!));
                    messenger.showSnackBar(SnackBar(content: Text(s.addressCopied)));
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// «Нет в наличии» — только после подтверждения: действие заметно меняет заказ клиента.
  Future<void> _confirmMissing(OrderItem it) async {
    final s = context.read<Lang>().s;
    final session = context.read<Session>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(s.confirmMissingTitle),
        content: Text(s.confirmMissingText(it.name)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(s.cancel)),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.sale),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(s.removeItem),
          ),
        ],
      ),
    );
    if (ok == true) await _do(() => session.api.markMissing(widget.orderId, it.id));
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: Text(o != null ? s.orderNo(o.number) : s.order)),
      body: _loading && o == null
          ? const Center(child: CircularProgressIndicator())
          : o == null
              ? Center(child: Text(_error ?? s.error, style: const TextStyle(color: AppColors.sale)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      _headerCard(s, o),
                      const SizedBox(height: 12),
                      _customerCard(s, o),
                      const SizedBox(height: 12),
                      _itemsCard(s, o),
                      const SizedBox(height: 12),
                      _payCard(s, o),
                    ],
                  ),
                ),
      bottomNavigationBar: o == null ? null : _actions(s, o),
    );
  }

  /// Подпись над блоком карточки: «КЛИЕНТ», «СОСТАВ ЗАКАЗА».
  Widget _sectionLabel(String text, {Widget? trailing}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.ink40, letterSpacing: 0.6)),
            if (trailing != null) ...[const SizedBox(width: 8), trailing],
          ],
        ),
      );

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color)),
      );

  /// Способ получения, статус и шкала этапов заказа.
  Widget _headerCard(S s, OrderDetail o) {
    final pickup = o.fulfillment == 'PICKUP';
    final cancelled = o.status == 'CANCELLED';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppColors.carrot50, borderRadius: BorderRadius.circular(12)),
                  alignment: Alignment.center,
                  child: Icon(pickup ? Icons.storefront : Icons.local_shipping_outlined, color: AppColors.carrot600),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(pickup ? s.pickup : s.delivery, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                      if (o.pickupAt != null)
                        Text(timeSlot(s, o.pickupAt!), style: const TextStyle(color: AppColors.ink60)),
                      if (!pickup && o.district != null)
                        Text(o.district!, style: const TextStyle(color: AppColors.ink60)),
                    ],
                  ),
                ),
                _chip(statusLabel(s, o.status), cancelled ? AppColors.sale : AppColors.carrot600),
              ],
            ),
            if (!cancelled) ...[
              const SizedBox(height: 16),
              _progress(s, o),
            ],
          ],
        ),
      ),
    );
  }

  /// Шкала: Новый → Принят → Сборка → Готов → В пути / К выдаче → Выдан.
  Widget _progress(S s, OrderDetail o) {
    const order = ['PLACED', 'ACCEPTED', 'PICKING', 'AWAITING_CUSTOMER', 'READY', 'COURIER_ASSIGNED', 'DELIVERING', 'DELIVERED', 'COMPLETED'];
    final pickup = o.fulfillment == 'PICKUP';
    final steps = <(String, String)>[
      ('PLACED', statusLabel(s, 'PLACED')),
      ('ACCEPTED', statusLabel(s, 'ACCEPTED')),
      ('PICKING', statusLabel(s, 'PICKING')),
      ('READY', statusLabel(s, 'READY')),
      ('DELIVERING', pickup ? s.readyForPickup : statusLabel(s, 'DELIVERING')),
      ('DELIVERED', statusLabel(s, 'DELIVERED')),
    ];
    final cur = order.indexOf(o.status);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++)
          Expanded(
            child: Builder(builder: (_) {
              final idx = order.indexOf(steps[i].$1);
              final next = i + 1 < steps.length ? order.indexOf(steps[i + 1].$1) : order.length;
              final done = cur >= next;
              final active = cur >= idx && cur < next;
              final color = done ? AppColors.leaf : active ? AppColors.carrot : AppColors.line;
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: Container(height: 3, color: i == 0 ? Colors.transparent : (cur >= idx ? AppColors.leaf : AppColors.line))),
                      Container(
                        width: 20, height: 20,
                        decoration: BoxDecoration(color: done || active ? color : AppColors.card, shape: BoxShape.circle, border: Border.all(color: color, width: 2)),
                        child: done ? const Icon(Icons.check, size: 13, color: Colors.white) : null,
                      ),
                      Expanded(child: Container(height: 3, color: i == steps.length - 1 ? Colors.transparent : (done ? AppColors.leaf : AppColors.line))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(steps[i].$2, textAlign: TextAlign.center, maxLines: 2,
                      style: TextStyle(fontSize: 11, height: 1.15, fontWeight: active ? FontWeight.w800 : FontWeight.w500, color: active ? AppColors.ink : AppColors.ink40)),
                ],
              );
            }),
          ),
      ],
    );
  }

  Widget _customerCard(S s, OrderDetail o) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionLabel(s.customer),
            if (!o.piiVisible) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    const Icon(Icons.lock_outline, color: AppColors.ink40, size: 20),
                    const SizedBox(width: 10),
                    Expanded(child: Text(s.piiHidden, style: const TextStyle(color: AppColors.ink60))),
                  ],
                ),
              ),
              if (o.district != null) ...[
                const SizedBox(height: 10),
                _infoRow(Icons.place_outlined, s.district(o.district!)),
              ],
              if (o.fulfillment == 'DELIVERY' && o.hasLocation) ...[
                const SizedBox(height: 12),
                DeliveryMap(lat: o.lat!, lng: o.lng!, approx: true),
              ],
            ] else ...[
              Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppColors.carrot50,
                    child: Text(_initial(o.customerName), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.customerName ?? '—', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                        if (o.customerPhone != null)
                          Text(formatKzPhone(o.customerPhone!), style: const TextStyle(fontSize: 15, color: AppColors.ink60, letterSpacing: 0.3)),
                      ],
                    ),
                  ),
                ],
              ),
              if (o.customerPhone != null) ...[
                const SizedBox(height: 14),
                ContactActions(phone: o.customerPhone!),
              ],
              if (o.fulfillment == 'DELIVERY' && o.addressLine != null) ...[
                const SizedBox(height: 14),
                InkWell(onTap: () => _route(o), child: _infoRow(Icons.place_outlined, o.addressLine!)),
              ],
              if (o.pickupAt != null) ...[
                const SizedBox(height: 14),
                _infoRow(Icons.schedule, o.fulfillment == 'PICKUP' ? s.pickupAt(timeSlot(s, o.pickupAt!)) : s.deliverAt(timeSlot(s, o.pickupAt!))),
              ],
              if (o.fulfillment == 'DELIVERY' && o.hasLocation) ...[
                const SizedBox(height: 12),
                DeliveryMap(lat: o.lat!, lng: o.lng!, approx: false, onTap: () => _route(o)),
              ],
              if (o.fulfillment == 'DELIVERY' && (o.hasLocation || o.addressLine != null)) ...[
                const SizedBox(height: 12),
                SizedBox(
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: () => _route(o),
                    icon: const Icon(Icons.directions),
                    label: Text(s.buildRoute),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  String _initial(String? name) {
    final n = (name ?? '').trim();
    return n.isEmpty ? '?' : n.substring(0, 1).toUpperCase();
  }

  Widget _infoRow(IconData icon, String text) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.carrot),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600))),
        ],
      );

  /// Сумма позиции: весовые — цена за кг × фактический (или заказанный) вес.
  int _lineTiyn(OrderItem it) {
    if (it.status == 'missing') return 0;
    if (it.weighted) return (it.priceSnapTiyn * (it.qtyActualG ?? it.qtyRequestedG ?? 0) / 1000).round();
    return it.priceSnapTiyn * (it.qtyRequested ?? 1);
  }

  Widget _itemsCard(S s, OrderDetail o) {
    final canPick = o.status == 'PICKING' || o.status == 'AWAITING_CUSTOMER';
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionLabel(s.orderItems, trailing: _chip('${o.items.length}', AppColors.ink60)),
            for (var i = 0; i < o.items.length; i++) ...[
              if (i > 0) const Divider(height: 1),
              _itemRow(s, o.items[i], canPick),
            ],
          ],
        ),
      ),
    );
  }

  Widget _itemRow(S s, OrderItem it, bool canPick) {
    final missing = it.status == 'missing';
    final needsWeigh = it.weighted && it.qtyActualG == null && !missing;
    final qty = it.weighted ? grams(s, it.qtyActualG ?? it.qtyRequestedG ?? 0) : '${it.qtyRequested ?? 1} ${s.unitPcs}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(it.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, decoration: missing ? TextDecoration.lineThrough : null, color: missing ? AppColors.ink40 : AppColors.ink)),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(qty, style: const TextStyle(color: AppColors.ink60, fontWeight: FontWeight.w600)),
                        if (needsWeigh) _chip(s.needsWeighing, AppColors.carrot600),
                        if (it.weighted && it.qtyActualG != null && !missing) ...[
                          _chip('✓ ${s.weighed}', AppColors.leaf),
                          if (it.qtyRequestedG != null && it.qtyRequestedG != it.qtyActualG)
                            Text(s.ordered(grams(s, it.qtyRequestedG!)), style: const TextStyle(fontSize: 12, color: AppColors.ink40)),
                        ],
                        if (missing) _chip(s.outOfStock, AppColors.sale),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(missing ? '—' : tenge(_lineTiyn(it)), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: missing ? AppColors.ink40 : AppColors.ink)),
              if (canPick)
                PopupMenuButton<String>(
                  tooltip: s.moreActions,
                  enabled: !_busy,
                  icon: const Icon(Icons.more_vert, color: AppColors.ink40),
                  onSelected: (v) => v == 'missing'
                      ? _confirmMissing(it)
                      : _do(() => context.read<Session>().api.restoreItem(widget.orderId, it.id)),
                  itemBuilder: (_) => [
                    missing
                        ? PopupMenuItem(value: 'restore', child: Text(s.restoreItem))
                        : PopupMenuItem(value: 'missing', child: Text(s.outOfStock)),
                  ],
                ),
            ],
          ),
          if (canPick && it.weighted && !missing) ...[
            const SizedBox(height: 8),
            it.qtyActualG == null
                ? FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.carrot),
                    onPressed: _busy ? null : () => _weighDialog(it),
                    icon: const Icon(Icons.scale_outlined, size: 18),
                    label: Text(s.weigh),
                  )
                : TextButton.icon(
                    style: TextButton.styleFrom(foregroundColor: AppColors.ink60, padding: EdgeInsets.zero),
                    onPressed: _busy ? null : () => _weighDialog(it),
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    label: Text(s.changeWeight),
                  ),
          ],
        ],
      ),
    );
  }

  Widget _payCard(S s, OrderDetail o) {
    final estimate = o.finalTiyn == null && o.items.any((it) => it.weighted && it.status != 'missing');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.total, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.ink40)),
                      const SizedBox(height: 2),
                      Text(tenge(o.finalTiyn ?? o.subtotalTiyn + o.deliveryFeeTiyn), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: AppColors.ink)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(s.payment, style: const TextStyle(fontSize: 12, color: AppColors.ink40)),
                    const SizedBox(height: 4),
                    _chip(payLabel(s, o.payMethod), AppColors.leaf),
                  ],
                ),
              ],
            ),
            if (o.deliveryFeeTiyn > 0) ...[
              // Чек: товары отдельно, доставка отдельно; крупная сумма выше — уже с доставкой.
              const SizedBox(height: 8),
              Text('${s.goodsSum}: ${tenge((o.finalTiyn ?? o.subtotalTiyn + o.deliveryFeeTiyn) - o.deliveryFeeTiyn)}', style: const TextStyle(fontSize: 14, color: AppColors.ink60)),
              Text('${s.deliveryFeeLabel}: ${tenge(o.deliveryFeeTiyn)}', style: const TextStyle(fontSize: 14, color: AppColors.ink60)),
            ],
            if (estimate) ...[
              const SizedBox(height: 8),
              Text(s.estimateNote, style: const TextStyle(fontSize: 13, color: AppColors.ink60)),
            ],
          ],
        ),
      ),
    );
  }

  Widget? _actions(S s, OrderDetail o) {
    final session = context.read<Session>();
    // Белая панель с основной кнопкой этапа; пока идёт запрос — индикатор вместо текста.
    Widget bar(Widget child) => Container(
          decoration: const BoxDecoration(color: AppColors.card, border: Border(top: BorderSide(color: AppColors.line))),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: SizedBox(height: 52, child: child),
            ),
          ),
        );

    switch (o.status) {
      case 'PLACED':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => session.api.transition(o.id, 'accept')), child: Text(s.acceptOrder)));
      case 'ACCEPTED':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => session.api.transition(o.id, 'picking')), child: Text(s.startPicking)));
      case 'PICKING':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => session.api.transition(o.id, 'ready')), child: Text(s.pickedReady)));
      case 'AWAITING_CUSTOMER':
        return bar(ElevatedButton(onPressed: _busy ? null : () => _do(() => session.api.transition(o.id, 'picking')), child: Text(s.resumePicking)));
      case 'READY':
        return bar(ElevatedButton(
          onPressed: _busy ? null : () => _do(() => session.api.delivering(o.id)),
          child: Text(o.fulfillment == 'PICKUP' ? s.readyForPickup : s.handToDelivery),
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
          child: Text(s.confirmByCode),
        ));
      default:
        return null;
    }
  }
}
