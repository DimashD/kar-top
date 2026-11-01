import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  StoreSettings? _s;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
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

  Future<void> _editLead() async {
    final ctrl = TextEditingController(text: _s!.pickupLeadMinutes.toString());
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Готовность к самовывозу'),
        content: TextField(controller: ctrl, keyboardType: TextInputType.number, decoration: const InputDecoration(suffixText: 'мин', helperText: 'Через сколько минут после заказа можно забрать')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Отмена')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)), child: const Text('Сохранить')),
        ],
      ),
    );
    if (result != null && result >= 0) await _save({'pickupLeadMinutes': result});
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final s = _s;
    if (s == null) return Center(child: Text(_error ?? 'Ошибка', style: const TextStyle(color: AppColors.sale)));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Доставка и самовывоз', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                value: s.pickupEnabled,
                activeThumbColor: AppColors.leaf,
                title: const Text('Самовывоз'),
                subtitle: const Text('Клиент забирает заказ сам'),
                onChanged: (v) => _save({'pickupEnabled': v}),
              ),
              const Divider(height: 1),
              ListTile(
                title: const Text('Готовность к самовывозу'),
                subtitle: Text('${s.pickupLeadMinutes} мин после оформления'),
                trailing: const Icon(Icons.chevron_right),
                enabled: s.pickupEnabled,
                onTap: s.pickupEnabled ? _editLead : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: const Icon(Icons.logout, color: AppColors.sale),
            title: const Text('Выйти из аккаунта'),
            onTap: () => context.read<Session>().logout(),
          ),
        ),
      ],
    );
  }
}
