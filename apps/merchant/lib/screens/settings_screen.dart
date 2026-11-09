import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../lock.dart';
import '../config.dart';
import '../widgets/language_picker.dart';
import '../widgets/share_store.dart';
import 'delivery_zones_screen.dart';
import 'catalog_request_screen.dart';

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

  bool _photoBusy = false;

  /// Снять/выбрать фото, ужать до 1280 px и загрузить. source == null — убрать фото.
  Future<void> _setPhoto(ImageSource? source) async {
    final session = context.read<Session>();
    String? data;
    if (source != null) {
      final img = await ImagePicker().pickImage(source: source, maxWidth: 1280, maxHeight: 1280, imageQuality: 80);
      if (img == null) return;
      data = base64Encode(await img.readAsBytes());
    }
    setState(() => _photoBusy = true);
    try {
      final v = await session.api.setStorePhoto(session.store!.id, data);
      setState(() => _s?.photoVersion = v);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _photoBusy = false);
    }
  }

  Widget _photoCard(S s, StoreSettings st, String slug) {
    final v = st.photoVersion;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (v != null)
            Image.network('$kApiBase/shops/$slug/photo?v=$v', height: 180, fit: BoxFit.cover),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(s.storePhotoHint, style: const TextStyle(color: AppColors.ink60)),
                const SizedBox(height: 10),
                if (_photoBusy)
                  const Center(child: CircularProgressIndicator())
                else
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilledButton.icon(onPressed: () => _setPhoto(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: Text(s.photoTake)),
                    OutlinedButton.icon(onPressed: () => _setPhoto(ImageSource.gallery), icon: const Icon(Icons.photo_library), label: Text(s.photoPick)),
                    if (v != null) TextButton(onPressed: () => _setPhoto(null), child: Text(s.photoRemove)),
                  ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// «Написать в Kartop»: не работает / идея / другое — сообщение попадает в админку («Обратная связь»).
  Future<void> _writeUs(S s) async {
    final session = context.read<Session>();
    final ctrl = TextEditingController();
    var kind = 'PROBLEM';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(s.writeUs, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 4),
              Text(s.writeUsHint, style: const TextStyle(color: AppColors.ink60)),
              const SizedBox(height: 12),
              Wrap(spacing: 8, children: [
                for (final k in [('PROBLEM', s.fbProblem), ('IDEA', s.fbIdea), ('OTHER', s.fbOther)])
                  ChoiceChip(label: Text(k.$2), selected: kind == k.$1, onSelected: (_) => set(() => kind = k.$1)),
              ]),
              const SizedBox(height: 12),
              TextField(controller: ctrl, maxLines: 5, maxLength: 2000, decoration: InputDecoration(hintText: s.fbPlaceholder, border: const OutlineInputBorder())),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(s.fbSend)),
            ],
          ),
        ),
      ),
    );
    final text = ctrl.text.trim();
    if (ok != true || text.length < 3) return;
    try {
      await session.api.sendFeedback(session.store!.id, kind, text);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.fbThanks)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  /// Часы работы: по дню — выходной или «открытие–закрытие»; время выбирается системными часами.
  Widget _hoursCard(S s, StoreSettings st) {
    final week = st.hours.length == 7 ? st.hours : List<Map<String, String>?>.generate(7, (_) => {'open': '08:00', 'close': '22:00'});
    Future<void> save(List<Map<String, String>?> next) => _save({'hours': next});
    Future<void> pick(int day, String field) async {
      final cur = week[day]![field]!;
      final t = await showTimePicker(
        context: context,
        initialTime: TimeOfDay(hour: int.parse(cur.substring(0, 2)) % 24, minute: int.parse(cur.substring(3))),
        builder: (ctx, child) => MediaQuery(data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true), child: child!),
      );
      if (t == null) return;
      final v = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
      // 00:00 как закрытие — «до полуночи».
      final value = field == 'close' && v == '00:00' ? '24:00' : v;
      final next = [...week];
      next[day] = {...next[day]!, field: value};
      await save(next);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(s.workHoursHint, style: const TextStyle(color: AppColors.ink60)),
            const SizedBox(height: 4),
            for (var i = 0; i < 7; i++)
              Row(children: [
                SizedBox(width: 36, child: Text(s.weekdays[i], style: const TextStyle(fontWeight: FontWeight.w800))),
                Switch(
                  value: week[i] != null,
                  onChanged: (on) {
                    final next = [...week];
                    next[i] = on ? {'open': '08:00', 'close': '22:00'} : null;
                    save(next);
                  },
                ),
                if (week[i] == null)
                  Text(s.dayOff, style: const TextStyle(color: AppColors.ink40))
                else ...[
                  TextButton(onPressed: () => pick(i, 'open'), child: Text(week[i]!['open']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                  const Text('—'),
                  TextButton(onPressed: () => pick(i, 'close'), child: Text(week[i]!['close']!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                ],
              ]),
            TextButton.icon(
              onPressed: week[0] == null ? null : () => save(List.generate(7, (_) => {...week[0]!})),
              icon: const Icon(Icons.copy_all, size: 18),
              label: Text(s.sameForAll),
            ),
          ],
        ),
      ),
    );
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

  /// Вкл/выкл способа получения. Выключить последний оставшийся нельзя — магазин не сможет принимать заказы.
  Future<void> _toggleMethod(String field, bool on, {required bool other}) async {
    if (!on && !other) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.read<Lang>().s.keepOneMethod)));
      return;
    }
    await _save({field: on});
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
    final store = context.watch<Session>().store;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (store != null) ...[
          StoreLinkCard(store: store),
          const SizedBox(height: 20),
          Text(s.storePhoto, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          _photoCard(s, st, store.slug),
          const SizedBox(height: 20),
          Card(
            child: Column(children: [
              ListTile(leading: const Icon(Icons.support_agent), title: Text(s.writeUs), subtitle: Text(s.writeUsHint), onTap: () => _writeUs(s)),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.add_box_outlined),
                title: Text(s.suggestProduct),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CatalogRequestScreen())),
              ),
            ]),
          ),
          const SizedBox(height: 20),
        ],
        Text(s.workHours, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        _hoursCard(s, st),
        const SizedBox(height: 20),
        Text(s.deliveryAndPickup, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        // Самовывоз
        Card(
          child: Column(
            children: [
              SwitchListTile(
                value: st.pickupEnabled,
                activeThumbColor: AppColors.leaf,
                secondary: const Icon(Icons.storefront_outlined, color: AppColors.carrot),
                title: Text(s.pickup, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(s.pickupSubtitle),
                onChanged: (v) => _toggleMethod('pickupEnabled', v, other: st.deliveryEnabled),
              ),
              if (st.pickupEnabled) ...[
                const Divider(height: 1),
                ListTile(
                  title: Text(s.pickupReadiness),
                  subtitle: Text(s.pickupLeadValue(st.pickupLeadMinutes)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _editMinutes(title: s.pickupReadiness, helper: s.pickupReadinessHelper, current: st.pickupLeadMinutes, field: 'pickupLeadMinutes'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        // Своя доставка магазина
        Card(
          child: Column(
            children: [
              SwitchListTile(
                value: st.deliveryEnabled,
                activeThumbColor: AppColors.leaf,
                secondary: const Icon(Icons.delivery_dining_outlined, color: AppColors.carrot),
                title: Text(s.ownDeliveryTitle, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(s.ownDeliverySubtitle),
                onChanged: (v) => _toggleMethod('deliveryEnabled', v, other: st.pickupEnabled),
              ),
              if (st.deliveryEnabled) ...[
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.map_outlined, color: AppColors.carrot),
                  title: Text(s.deliveryZone),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DeliveryZonesScreen())),
                ),
                const Divider(height: 1),
                ListTile(
                  title: Text(s.averageTime),
                  subtitle: Text(s.aboutMinutes(st.ownDeliveryMinutes)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _editMinutes(title: s.averageTime, helper: s.ownDeliveryHelper, current: st.ownDeliveryMinutes, field: 'ownDeliveryMinutes'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        // Курьерская служба — пока не работает: выключатель неактивен, метка «Скоро».
        Card(
          child: SwitchListTile(
            value: false,
            onChanged: null,
            secondary: const Icon(Icons.local_shipping_outlined, color: AppColors.ink40),
            title: Row(
              children: [
                Flexible(child: Text(s.courierService, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.carrot50, borderRadius: BorderRadius.circular(999)),
                  child: Text(s.soon, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                ),
              ],
            ),
            subtitle: Text(s.courierServiceSubtitle),
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
