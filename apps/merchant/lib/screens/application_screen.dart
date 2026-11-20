import 'dart:convert';
import 'package:material_ui/material_ui.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../l10n.dart';
import '../models.dart';
import '../onboarding_l10n.dart';
import '../session.dart';
import '../theme.dart';
import 'home_screen.dart';

/// Заявка магазина: данные → фото магазина → договор на бумаге (фото + удостоверение) → отправка на проверку.
/// storeId == null — новая заявка (магазин создаётся при первом сохранении).
class ApplicationScreen extends StatefulWidget {
  final String? storeId;
  const ApplicationScreen({super.key, this.storeId});
  @override
  State<ApplicationScreen> createState() => _ApplicationScreenState();
}

class _ApplicationScreenState extends State<ApplicationScreen> {
  final _name = TextEditingController();
  final _legal = TextEditingController();
  final _bin = TextEditingController();
  final _address = TextEditingController();
  String? _storeId;
  StoreApplication? _a;
  bool _busy = false;
  String? _err;

  @override
  void initState() {
    super.initState();
    _storeId = widget.storeId;
    if (_storeId != null) _load();
  }

  @override
  void dispose() {
    for (final c in [_name, _legal, _bin, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final a = await context.read<Session>().api.application(_storeId!);
      if (!mounted) return;
      setState(() {
        _a = a;
        _name.text = a.name;
        _legal.text = a.legalName ?? '';
        _bin.text = a.legalBin ?? '';
        _address.text = a.address ?? '';
      });
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    }
  }

  Future<void> _run(Future<void> Function() f) async {
    setState(() { _busy = true; _err = null; });
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool get _formValid =>
      _name.text.trim().length >= 2 && _legal.text.trim().length >= 3 && RegExp(r'^\d{12}$').hasMatch(_bin.text.trim()) && _address.text.trim().length >= 5;

  Map<String, dynamic> get _body => {'name': _name.text.trim(), 'legalName': _legal.text.trim(), 'bin': _bin.text.trim(), 'address': _address.text.trim()};

  Future<void> _save() => _run(() async {
        final api = context.read<Session>().api;
        if (_storeId == null) {
          final st = await api.createApplication(_body);
          _storeId = st.id;
        } else {
          await api.updateApplication(_storeId!, _body);
        }
        await _load();
      });

  Future<void> _addPhoto(String kind, ImageSource source) async {
    final img = await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 80);
    if (img == null) return;
    final data = base64Encode(await img.readAsBytes());
    if (!mounted) return;
    await _run(() async {
      await context.read<Session>().api.addStoreDocument(_storeId!, kind, data);
      await _load();
    });
  }

  Future<void> _removePhoto(String docId) => _run(() async {
        await context.read<Session>().api.deleteStoreDocument(_storeId!, docId);
        await _load();
      });

  Future<void> _openContract() => _run(() async {
        final url = await context.read<Session>().api.contractLink(_storeId!);
        final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).catchError((_) => false);
        if (!ok && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(S.of(context).cannotOpen)));
      });

  Future<void> _submit() => _run(() async {
        final a = await context.read<Session>().api.submitApplication(_storeId!);
        if (mounted) setState(() => _a = a);
      });

  void _openStore() {
    final a = _a;
    if (a == null) return;
    final session = context.read<Session>();
    session.selectStore(StoreSummary(id: a.id, slug: a.slug, name: a.name, status: a.status, myRole: 'OWNER', selfRegistered: true));
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HomeScreen()));
  }

  void _pickSource(String kind) {
    final s = S.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_camera), title: Text(s.photoTake), onTap: () { Navigator.pop(ctx); _addPhoto(kind, ImageSource.camera); }),
          ListTile(leading: const Icon(Icons.photo_library), title: Text(s.photoPick), onTap: () { Navigator.pop(ctx); _addPhoto(kind, ImageSource.gallery); }),
        ]),
      ),
    );
  }

  Widget _photos(String kind, String label, bool editable) {
    final api = context.read<Session>().api;
    final ids = _a?.docs(kind) ?? const <String>[];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final id in ids)
          Stack(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(api.storeDocumentUrl(_storeId!, id), headers: api.authHeaders, width: 92, height: 92, fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(width: 92, height: 92, color: AppColors.line, child: const Icon(Icons.image_outlined))),
            ),
            if (editable)
              Positioned(
                right: 0, top: 0,
                child: IconButton(
                  visualDensity: VisualDensity.compact,
                  style: IconButton.styleFrom(backgroundColor: Colors.black54),
                  onPressed: _busy ? null : () => _removePhoto(id),
                  icon: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
          ]),
        if (editable)
          InkWell(
            onTap: _busy ? null : () => _pickSource(kind),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 92, height: 92,
              decoration: BoxDecoration(border: Border.all(color: AppColors.line), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.add_a_photo_outlined, color: AppColors.ink60),
            ),
          ),
      ]),
    ]);
  }

  Widget _check(bool ok, String label) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked, size: 20, color: ok ? AppColors.leaf : AppColors.ink40),
          const SizedBox(width: 8),
          Expanded(child: Text(label)),
        ]),
      );

  Widget _card(String title, List<Widget> children) => Card(
        margin: const EdgeInsets.only(bottom: 14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ...children,
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final o = OnbS.of(context);
    final a = _a;
    final editable = a == null || a.editable;
    final created = _storeId != null && a != null;
    Widget field(TextEditingController c, String label, {String? hint, TextInputType? kb, int? max}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(
            controller: c, enabled: editable && !_busy, keyboardType: kb, maxLength: max,
            decoration: InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder(), counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
        );

    return Scaffold(
      appBar: AppBar(title: Text(o.title)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (a?.state == 'SUBMITTED') _banner(o.submitted, AppColors.leaf50, Icons.hourglass_top),
        if (a?.state == 'REJECTED') _banner('${o.rejected} ${a!.rejectReason ?? ''}', AppColors.sale.withValues(alpha: 0.1), Icons.edit_note),
        if (a?.state == 'APPROVED') _banner(o.approved, AppColors.leaf50, Icons.check_circle),
        if (_storeId == null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(o.applyHint)),
        _card(o.stepData, [
          field(_name, o.name),
          field(_legal, o.legalName, hint: o.legalNameHint),
          field(_bin, o.bin, kb: TextInputType.number, max: 12),
          field(_address, o.address),
          if (editable) FilledButton(onPressed: _formValid && !_busy ? _save : null, child: Text(o.save)),
          if (created) ...[
            const SizedBox(height: 16),
            _photos('SIGN_PHOTO', o.signPhoto, editable),
            const SizedBox(height: 12),
            _photos('INSIDE_PHOTO', o.insidePhoto, editable),
          ],
        ]),
        _card(o.stepContract, !created ? [Text(o.saveFirst, style: const TextStyle(color: AppColors.ink60))] : [
          ListTile(
            contentPadding: EdgeInsets.zero, enabled: false,
            leading: const Icon(Icons.qr_code_2), title: Text(o.egov),
            trailing: Chip(label: Text(o.soon)),
          ),
          const Divider(),
          Text(o.paper, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('1. ${o.paper1}'),
          Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: _busy ? null : _openContract, icon: const Icon(Icons.download), label: Text(o.openContract))),
          Text('2. ${o.paper2}'),
          const SizedBox(height: 6),
          Text('3. ${o.paper3}'),
          const SizedBox(height: 10),
          _photos('CONTRACT', o.contractPhotos, editable),
          const SizedBox(height: 12),
          _photos('ID_CARD', o.idCard, editable),
        ]),
        if (created)
          _card(o.stepSend, [
            _check(a.checks['data'] == true && a.checks['bin'] == true, o.chkData),
            _check(a.checks['photos'] == true, o.chkPhotos),
            _check(a.checks['contract'] == true, o.chkContract),
            const SizedBox(height: 10),
            if (editable) FilledButton(onPressed: a.ready && !_busy ? _submit : null, child: Text(o.submit)),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: _openStore, child: Text(o.products.replaceAll('{n}', '${a.productCount}'))),
          ]),
        if (_busy) const Padding(padding: EdgeInsets.all(8), child: Center(child: CircularProgressIndicator())),
        if (_err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_err!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      ]),
    );
  }

  Widget _banner(String text, Color bg, IconData icon) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon),
          const SizedBox(width: 10),
          Expanded(child: Text(text)),
        ]),
      );
}
