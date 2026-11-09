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
        ],
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
