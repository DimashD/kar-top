import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../session.dart';
import '../theme.dart';

/// Одна зона доставки в редакторе: круг вокруг магазина или обведённая на карте область.
class ZoneEdit {
  String kind; // radius | polygon
  int radiusM;
  List<LatLng> points;
  int fee; // тенге
  int minOrder;
  int? freeFrom;
  ZoneEdit({this.kind = 'radius', this.radiusM = 1000, List<LatLng>? points, this.fee = 0, this.minOrder = 0, this.freeFrom})
      : points = points ?? [];

  factory ZoneEdit.fromJson(Map<String, dynamic> j) => ZoneEdit(
        kind: j['kind'] as String? ?? 'polygon',
        radiusM: (j['radiusM'] as num?)?.toInt() ?? 1000,
        points: ((j['points'] as List?) ?? []).map((p) => LatLng((p[0] as num).toDouble(), (p[1] as num).toDouble())).toList(),
        fee: ((j['feeTiyn'] as num?)?.toInt() ?? 0) ~/ 100,
        minOrder: ((j['minOrderTiyn'] as num?)?.toInt() ?? 0) ~/ 100,
        freeFrom: (j['freeFromTiyn'] as num?) == null ? null : (j['freeFromTiyn'] as num).toInt() ~/ 100,
      );

  Map<String, dynamic> toJson() => {
        'kind': kind,
        if (kind == 'radius') 'radiusM': radiusM,
        if (kind == 'polygon') 'points': points.map((p) => [p.latitude, p.longitude]).toList(),
        'feeTiyn': fee * 100,
        'minOrderTiyn': minOrder * 100,
        'freeFromTiyn': freeFrom == null ? null : freeFrom! * 100,
      };
}

/// «Зона доставки»: точка магазина и до 5 зон. Магазин сам выбирает, как задать зону:
/// радиус вокруг магазина (ползунок) или обвести район на карте (тапами по углам).
/// У каждой зоны — своя цена доставки, минимальный заказ и «бесплатно от».
class DeliveryZonesScreen extends StatefulWidget {
  const DeliveryZonesScreen({super.key});
  @override
  State<DeliveryZonesScreen> createState() => _DeliveryZonesScreenState();
}

class _DeliveryZonesScreenState extends State<DeliveryZonesScreen> {
  static const _almaty = LatLng(43.238, 76.889);
  static const _colors = [AppColors.carrot, Color(0xFF2F6FDE), Color(0xFF7B4FD6), AppColors.leaf, Color(0xFFD48A00)];
  final _map = MapController();
  LatLng? _store;
  List<ZoneEdit> _zones = [];
  int _sel = 0;
  bool _loading = true;
  bool _saving = false;
  bool _placingStore = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final s = context.read<Session>();
    try {
      final r = await s.api.zones(s.store!.id);
      final loc = r['location'] as Map<String, dynamic>?;
      setState(() {
        _store = loc == null ? null : LatLng((loc['lat'] as num).toDouble(), (loc['lng'] as num).toDouble());
        _zones = ((r['zones'] as List?) ?? []).map((z) => ZoneEdit.fromJson(z as Map<String, dynamic>)).toList();
        _placingStore = _store == null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  ZoneEdit? get _zone => _zones.isEmpty ? null : _zones[_sel.clamp(0, _zones.length - 1)];

  Future<void> _save() async {
    final s = context.read<Lang>().s;
    final session = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    if (_store == null) {
      messenger.showSnackBar(SnackBar(content: Text(s.needStorePoint)));
      return;
    }
    if (_zones.any((z) => z.kind == 'polygon' && z.points.length < 3)) {
      messenger.showSnackBar(SnackBar(content: Text(s.needThreePoints)));
      return;
    }
    setState(() => _saving = true);
    try {
      await session.api.saveZones(session.store!.id, {
        'lat': _store!.latitude,
        'lng': _store!.longitude,
        'zones': _zones.map((z) => z.toJson()).toList(),
      });
      messenger.showSnackBar(SnackBar(content: Text(s.savedLabel)));
      // Сохранили — возвращаемся в настройки.
      if (mounted) Navigator.of(context).pop(true);
      return;
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _onTap(LatLng p) {
    final z = _zone;
    if (_placingStore || z == null || z.kind != 'polygon') return;
    setState(() => z.points.add(p));
  }

  String _radiusLabel(int m) => m < 1000 ? '$m м' : '${(m / 1000).toStringAsFixed(m % 1000 == 0 ? 0 : 1)} км';

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    if (_loading) return Scaffold(appBar: AppBar(title: Text(s.deliveryZone)), body: const Center(child: CircularProgressIndicator()));
    final z = _zone;
    return Scaffold(
      appBar: AppBar(
        title: Text(s.deliveryZone),
        actions: [
          TextButton(onPressed: _saving ? null : _save, child: Text(_saving ? '…' : s.save, style: const TextStyle(fontWeight: FontWeight.w800))),
        ],
      ),
      body: Column(
        children: [
          // Карта: магазин, зоны; при обводке — тапы добавляют углы.
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.42,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: _store ?? _almaty,
                    initialZoom: 14,
                    onTap: (_, p) => _onTap(p),
                  ),
                  children: [
                    TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'kz.kartop.kartop_merchant', maxZoom: 19),
                    if (_store != null)
                      CircleLayer(circles: [
                        for (var i = 0; i < _zones.length; i++)
                          if (_zones[i].kind == 'radius')
                            CircleMarker(
                              point: _store!,
                              radius: _zones[i].radiusM.toDouble(),
                              useRadiusInMeter: true,
                              color: _colors[i % _colors.length].withValues(alpha: i == _sel ? 0.18 : 0.08),
                              borderColor: _colors[i % _colors.length],
                              borderStrokeWidth: i == _sel ? 3 : 1.5,
                            ),
                      ]),
                    PolygonLayer(polygons: [
                      for (var i = 0; i < _zones.length; i++)
                        if (_zones[i].kind == 'polygon' && _zones[i].points.length >= 3)
                          Polygon(
                            points: _zones[i].points,
                            color: _colors[i % _colors.length].withValues(alpha: i == _sel ? 0.18 : 0.08),
                            borderColor: _colors[i % _colors.length],
                            borderStrokeWidth: i == _sel ? 3 : 1.5,
                          ),
                    ]),
                    if (z != null && z.kind == 'polygon' && z.points.isNotEmpty)
                      MarkerLayer(markers: [
                        for (final p in z.points)
                          Marker(point: p, width: 14, height: 14, child: Container(decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: _colors[_sel % _colors.length], width: 3)))),
                      ]),
                    if (_store != null && !_placingStore)
                      MarkerLayer(markers: [
                        Marker(point: _store!, width: 40, height: 40, child: const Icon(Icons.storefront, color: AppColors.ink, size: 32)),
                      ]),
                  ],
                ),
                // Ставим магазин: перекрестие в центре карты.
                if (_placingStore) ...[
                  const IgnorePointer(child: Center(child: Icon(Icons.add_location_alt, size: 44, color: AppColors.carrot))),
                  Positioned(
                    left: 12, right: 12, bottom: 12,
                    child: ElevatedButton.icon(
                      onPressed: () => setState(() { _store = _map.camera.center; _placingStore = false; }),
                      icon: const Icon(Icons.storefront),
                      label: Text(s.storeHere),
                    ),
                  ),
                  Positioned(
                    left: 12, right: 12, top: 12,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.95), borderRadius: BorderRadius.circular(12)),
                      child: Text(s.storeHint, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (!_placingStore)
                  OutlinedButton.icon(
                    onPressed: () => setState(() => _placingStore = true),
                    icon: const Icon(Icons.storefront_outlined),
                    label: Text(s.moveStore),
                  ),
                const SizedBox(height: 12),
                // Зоны: чипы + «Добавить»
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (var i = 0; i < _zones.length; i++)
                      ChoiceChip(
                        label: Text(s.zoneN(i + 1)),
                        selected: i == _sel,
                        selectedColor: _colors[i % _colors.length].withValues(alpha: 0.2),
                        onSelected: (_) => setState(() => _sel = i),
                      ),
                    if (_zones.length < 5)
                      ActionChip(
                        avatar: const Icon(Icons.add, size: 18),
                        label: Text(s.addZone),
                        onPressed: () => setState(() {
                          final last = _zones.isEmpty ? null : _zones.last;
                          _zones.add(ZoneEdit(radiusM: last == null ? 1000 : (last.radiusM + 1000).clamp(100, 30000), fee: last == null ? 0 : last.fee + 300, minOrder: last?.minOrder ?? 0));
                          _sel = _zones.length - 1;
                        }),
                      ),
                  ],
                ),
                if (_zones.isEmpty) ...[
                  const SizedBox(height: 12),
                  Text(s.noZonesHint, style: const TextStyle(color: AppColors.ink60)),
                ],
                if (z != null) ..._zoneEditor(s, z),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _zoneEditor(S s, ZoneEdit z) => [
        const SizedBox(height: 16),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(value: 'radius', icon: const Icon(Icons.radio_button_unchecked), label: Text(s.zoneRadius)),
            ButtonSegment(value: 'polygon', icon: const Icon(Icons.gesture), label: Text(s.zoneDraw)),
          ],
          selected: {z.kind},
          onSelectionChanged: (v) => setState(() => z.kind = v.first),
        ),
        const SizedBox(height: 12),
        if (z.kind == 'radius') ...[
          Row(children: [
            Text(s.zoneRadius, style: const TextStyle(fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(_radiusLabel(z.radiusM), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          ]),
          Slider(
            value: z.radiusM.toDouble(),
            min: 100,
            max: 10000,
            divisions: 99,
            onChanged: (v) => setState(() => z.radiusM = v.round()),
          ),
        ] else ...[
          Text(s.drawHint, style: const TextStyle(color: AppColors.ink60)),
          const SizedBox(height: 8),
          Row(children: [
            OutlinedButton.icon(
              onPressed: z.points.isEmpty ? null : () => setState(() => z.points.removeLast()),
              icon: const Icon(Icons.undo, size: 18),
              label: Text(s.undoPoint),
            ),
            const SizedBox(width: 8),
            TextButton(onPressed: z.points.isEmpty ? null : () => setState(() => z.points.clear()), child: Text(s.clearPoints)),
            const Spacer(),
            Text('${z.points.length}', style: const TextStyle(fontWeight: FontWeight.w800)),
          ]),
        ],
        const SizedBox(height: 12),
        _money(s.deliveryFeeLabel, z.fee, (v) => z.fee = v ?? 0),
        _money(s.minOrderLabel, z.minOrder, (v) => z.minOrder = v ?? 0),
        _money(s.freeFromLabel, z.freeFrom, (v) => z.freeFrom = v, optional: true),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: AppColors.sale),
            onPressed: () => setState(() { _zones.remove(z); _sel = 0; }),
            icon: const Icon(Icons.delete_outline, size: 18),
            label: Text(s.deleteZone),
          ),
        ),
      ];

  Widget _money(String label, int? value, void Function(int?) set, {bool optional = false}) => Padding(
        key: ValueKey('$label-$_sel'),
        padding: const EdgeInsets.only(bottom: 10),
        child: TextFormField(
          initialValue: value?.toString() ?? '',
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: label, suffixText: '₸', hintText: optional ? '—' : '0'),
          onChanged: (v) => set(v.isEmpty ? (optional ? null : 0) : int.tryParse(v)),
        ),
      );
}
