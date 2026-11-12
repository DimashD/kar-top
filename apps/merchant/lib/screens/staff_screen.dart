import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../models.dart';
import '../phone.dart';
import '../session.dart';
import '../theme.dart';

/// Сотрудники магазина. Владелец выдаёт доступ по номеру телефона, меняет роль и забирает доступ.
/// Менеджер видит список, но менять не может.
class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});
  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  static const _roles = ['MANAGER', 'PICKER', 'COURIER'];
  List<StoreMemberInfo>? _list;
  String? _error;

  bool get _isOwner => context.read<Session>().store?.myRole == 'OWNER';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _run(Future<List<StoreMemberInfo>> Function() f) async {
    setState(() => _error = null);
    try {
      final list = await f();
      if (mounted) setState(() => _list = list);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _load() {
    final s = context.read<Session>();
    return _run(() => s.api.members(s.store!.id));
  }

  Future<void> _add() async {
    final s = S.of(context);
    final session = context.read<Session>();
    final phone = TextEditingController(text: '+7');
    final name = TextEditingController();
    var role = 'PICKER';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(s.addStaff, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [KzPhoneFormatter()],
              decoration: InputDecoration(labelText: s.phone, hintText: '+7 701 123 45 67'),
            ),
            const SizedBox(height: 8),
            TextField(controller: name, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: s.staffName)),
            const SizedBox(height: 12),
            for (final r in _roles)
              ListTile(
                onTap: () => setSheet(() => role = r),
                contentPadding: EdgeInsets.zero,
                leading: Icon(role == r ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.carrot),
                title: Text(s.roles[r] ?? r, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(s.roleHints[r] ?? ''),
              ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.carrot50, borderRadius: BorderRadius.circular(12)),
              child: Text(s.staffHowTo, style: const TextStyle(color: AppColors.ink60)),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: Text(s.grantAccess)),
          ]),
        ),
      ),
    );
    if (ok == true) {
      await _run(() => session.api.addMember(session.store!.id, kzPhoneE164(phone.text), role, name.text.trim()));
    }
  }

  Future<void> _edit(StoreMemberInfo m) async {
    final s = S.of(context);
    final session = context.read<Session>();
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(m.name ?? formatKzPhone(m.phone), style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(formatKzPhone(m.phone))),
          for (final r in _roles)
            ListTile(
              leading: Icon(m.role == r ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.carrot),
              title: Text(s.roles[r] ?? r),
              subtitle: Text(s.roleHints[r] ?? ''),
              onTap: () => Navigator.pop(ctx, r),
            ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.person_remove_outlined, color: AppColors.sale),
            title: Text(s.removeAccess, style: const TextStyle(color: AppColors.sale, fontWeight: FontWeight.w700)),
            onTap: () => Navigator.pop(ctx, 'REMOVE'),
          ),
        ]),
      ),
    );
    if (choice == null || choice == m.role || !mounted) return;
    if (choice == 'REMOVE') {
      final sure = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(s.removeAccess),
          content: Text(s.removeAccessConfirm),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(s.cancel)),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(s.removeAccess, style: const TextStyle(color: AppColors.sale))),
          ],
        ),
      );
      if (sure == true) await _run(() => session.api.removeMember(session.store!.id, m.userId));
      return;
    }
    await _run(() => session.api.updateMember(session.store!.id, m.userId, choice));
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final list = _list;
    return Scaffold(
      appBar: AppBar(title: Text(s.staff)),
      floatingActionButton: _isOwner
          ? FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.person_add_alt_1), label: Text(s.addStaff))
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: AppColors.sale))),
            if (list == null && _error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
            if (list != null)
              Card(
                child: Column(children: [
                  for (var i = 0; i < list.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _tile(s, list[i]),
                  ],
                ]),
              ),
            const SizedBox(height: 12),
            Text(s.staffHowTo, style: const TextStyle(color: AppColors.ink60)),
          ],
        ),
      ),
    );
  }

  Widget _tile(S s, StoreMemberInfo m) {
    final editable = _isOwner && m.role != 'OWNER' && !m.you;
    final title = m.name?.isNotEmpty == true ? m.name! : formatKzPhone(m.phone);
    return ListTile(
      onTap: editable ? () => _edit(m) : null,
      leading: CircleAvatar(
        backgroundColor: AppColors.carrot50,
        child: Text(title.characters.first.toUpperCase(), style: const TextStyle(color: AppColors.carrot600, fontWeight: FontWeight.w800)),
      ),
      title: Text(m.you ? '$title · ${s.you}' : title, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text([
        if (m.name?.isNotEmpty == true) formatKzPhone(m.phone),
        s.roles[m.role] ?? m.role,
        if (m.role != 'OWNER') m.active ? s.staffActive : s.staffInvited,
      ].join(' · ')),
      trailing: editable ? const Icon(Icons.chevron_right, color: AppColors.ink40) : null,
    );
  }
}
