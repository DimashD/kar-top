import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../push.dart';
import '../session.dart';
import '../theme.dart';

/// Центр уведомлений: все уведомления пользователя, новые выделены; нажатие на заказ — карточка заказа.
/// При открытии все отмечаются прочитанными (счётчик на колокольчике сбрасывается).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<Session>().api;
    try {
      final (_, items) = await api.notifications();
      if (mounted) setState(() => _items = items);
      await api.readNotifications();
      pushTick.value++;
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: Text(s.notificationsTitle)),
      body: items == null
          ? Center(child: _error != null ? Text(_error!, style: const TextStyle(color: AppColors.sale)) : const CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: items.isEmpty
                  ? ListView(children: [Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.noNotifications, style: const TextStyle(color: AppColors.ink60))))])
                  : ListView.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final n = items[i];
                        return ListTile(
                          tileColor: n.read ? null : AppColors.carrot50,
                          leading: Icon(n.type.startsWith('order.') ? Icons.receipt_long : Icons.notifications_outlined, color: AppColors.carrot),
                          title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w600 : FontWeight.w800)),
                          subtitle: Text('${n.body}\n${dateTime(s, n.createdAt)}'),
                          isThreeLine: true,
                          onTap: n.type.startsWith('order.') && n.refId != null ? () => PushService.instance.openOrder(n.refId) : null,
                        );
                      },
                    ),
            ),
    );
  }
}

/// Колокольчик в шапке: число непрочитанных, обновляется при каждом пуше.
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});
  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    pushTick.addListener(_refresh);
    _refresh();
  }

  @override
  void dispose() {
    pushTick.removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final (unread, _) = await context.read<Session>().api.notifications();
      if (mounted) setState(() => _unread = unread);
    } catch (_) {/* не критично */}
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: S.of(context).notificationsTitle,
      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
      icon: Badge(isLabelVisible: _unread > 0, label: Text('$_unread'), child: const Icon(Icons.notifications_outlined)),
    );
  }
}
