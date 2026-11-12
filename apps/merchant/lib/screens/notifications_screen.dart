import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
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
                        final (icon, bg, fg) = _look(n.type);
                        return ListTile(
                          tileColor: n.read ? null : AppColors.carrot50,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                          leading: Container(
                            width: 42, height: 42,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                            child: Icon(icon, size: 22, color: fg),
                          ),
                          title: Text(_plain(n.title), maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontWeight: n.read ? FontWeight.w600 : FontWeight.w800)),
                          subtitle: Text(n.body, maxLines: 1, overflow: TextOverflow.ellipsis),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(_when(n.createdAt), style: const TextStyle(fontSize: 12, color: AppColors.ink40)),
                              if (!n.read) ...[
                                const SizedBox(height: 6),
                                Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.carrot, shape: BoxShape.circle)),
                              ],
                            ],
                          ),
                          onTap: n.type.startsWith('order.') && n.refId != null ? () => PushService.instance.openOrder(n.refId) : null,
                        );
                      },
                    ),
            ),
    );
  }
}

/// Значок и фон по событию.
(IconData, Color, Color) _look(String type) => switch (type) {
      'order.placed' => (Icons.shopping_cart_outlined, const Color(0xFFFCEDE6), AppColors.carrot),
      'order.reviewed' => (Icons.star_outline_rounded, const Color(0xFFFFF4D6), const Color(0xFF8A5A00)),
      'order.cancelled' => (Icons.cancel_outlined, const Color(0xFFF4F2F0), AppColors.ink60),
      'billing.invoice_issued' || 'billing.invoice_paid' => (Icons.receipt_long_outlined, const Color(0xFFE9F2EB), AppColors.leaf),
      'store.update_reminder' => (Icons.wb_twilight_outlined, const Color(0xFFFFF4D6), const Color(0xFF8A5A00)),
      _ => (Icons.notifications_none_rounded, const Color(0xFFF4F2F0), AppColors.ink60),
    };

/// Заголовок без значка в начале (значок уже слева).
String _plain(String s) {
  final i = s.indexOf(' ');
  final starts = s.isEmpty ? '' : s.substring(0, 1);
  return i > 0 && !RegExp(r'[0-9A-Za-zА-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ№«]').hasMatch(starts) ? s.substring(i + 1) : s;
}

/// Время: сегодня — «14:32», иначе — дата и время.
String _when(DateTime d) {
  final l = d.toLocal(), now = DateTime.now();
  final hm = '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  return l.year == now.year && l.month == now.month && l.day == now.day ? hm : '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')} $hm';
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
