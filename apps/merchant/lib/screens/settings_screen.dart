import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../lock.dart';
import '../widgets/language_picker.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  StoreSettings? _s;
  bool _loading = true;
  bool _lockEnabled = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    AppLock.isEnabled().then((v) => setState(() => _lockEnabled = v));
  }

  Future<void> _load() async {
    final s = context.read<Session>();
    try {
      final st = await s.api.settings(s.store!.id);
      setState(() { _s = st; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _toggleLock(bool on) async {
    if (!on) {
      await AppLock.disable();
      setState(() => _lockEnabled = false);
      return;
    }
    final pin = await _askPin();
    if (pin != null && pin.length == 4) {
      await AppLock.enable(pin);
      setState(() => _lockEnabled = true);
    }
  }

  Future<String?> _askPin() {
    final s = context.read<Lang>().s;
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(s.setPin),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 4,
          decoration: const InputDecoration(hintText: '••••'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.cancel)),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: Text(s.enable)),
        ],
      ),
    );
  }

  Future<void> _save(Map<String, dynamic> patch) async {
    final s = context.read<Session>();
    try {
      final updated = await s.api.updateSettings(s.store!.id, patch);
      setState(() => _s = updated);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      await _load();
    }
  }

  /// Диалог «сколько минут»: общий для самовывоза, курьерской службы и своей доставки.
  Future<void> _editMinutes({required String title, required String helper, required int current, required String field}) async {
    final s = context.read<Lang>().s;
    final ctrl = TextEditingController(text: current.toString());
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(suffixText: s.minutes, helperText: helper, helperMaxLines: 3),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.cancel)),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)), child: Text(s.save)),
        ],
      ),
    );
    if (result != null && result >= 0 && result <= 1440) await _save({field: result});
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    if (_loading) return const Center(child: CircularProgressIndicator());
    final st = _s;
    if (st == null) return Center(child: Text(_error ?? s.error, style: const TextStyle(color: AppColors.sale)));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(s.deliveryAndPickup, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                value: st.pickupEnabled,
                activeThumbColor: AppColors.leaf,
                title: Text(s.pickup),
                subtitle: Text(s.pickupSubtitle),
                onChanged: (v) => _save({'pickupEnabled': v}),
              ),
              const Divider(height: 1),
              ListTile(
                title: Text(s.pickupReadiness),
                subtitle: Text(s.pickupLeadValue(st.pickupLeadMinutes)),
                trailing: const Icon(Icons.chevron_right),
                enabled: st.pickupEnabled,
                onTap: st.pickupEnabled
                    ? () => _editMinutes(title: s.pickupReadiness, helper: s.pickupReadinessHelper, current: st.pickupLeadMinutes, field: 'pickupLeadMinutes')
                    : null,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.local_shipping_outlined, color: AppColors.carrot),
                title: Text(s.courierHandover),
                subtitle: Text(s.pickupLeadValue(st.courierHandoverMinutes)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _editMinutes(title: s.courierHandover, helper: s.courierHandoverHelper, current: st.courierHandoverMinutes, field: 'courierHandoverMinutes'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.delivery_dining_outlined, color: AppColors.carrot),
                title: Text(s.ownDelivery),
                subtitle: Text(s.aboutMinutes(st.ownDeliveryMinutes)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _editMinutes(title: s.ownDelivery, helper: s.ownDeliveryHelper, current: st.ownDeliveryMinutes, field: 'ownDeliveryMinutes'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text(s.security, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        Card(
          child: SwitchListTile(
            value: _lockEnabled,
            activeThumbColor: AppColors.leaf,
            secondary: const Icon(Icons.lock_outline, color: AppColors.carrot),
            title: Text(s.appLock),
            subtitle: Text(s.appLockSubtitle),
            onChanged: _toggleLock,
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: const Icon(Icons.language, color: AppColors.carrot),
            title: Text(s.language),
            subtitle: Text(S.names[s.code]!),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showLanguagePicker(context),
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: const Icon(Icons.logout, color: AppColors.sale),
            title: Text(s.logout),
            onTap: () => context.read<Session>().logout(),
          ),
        ),
      ],
    );
  }
}
