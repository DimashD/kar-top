import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../session.dart';
import '../theme.dart';

/// Заявка магазина на новую категорию или товар в общий каталог.
/// Платформа рассматривает и одобряет (тогда позиция появляется в каталоге).
class CatalogRequestScreen extends StatefulWidget {
  const CatalogRequestScreen({super.key});
  @override
  State<CatalogRequestScreen> createState() => _CatalogRequestScreenState();
}

class _CatalogRequestScreenState extends State<CatalogRequestScreen> {
  String _type = 'PRODUCT';
  final _name = TextEditingController();
  final _category = TextEditingController();
  final _note = TextEditingController();
  String _unit = 'KG';
  bool _busy = false;
  bool _done = false;
  String? _error;

  static const _units = ['KG', 'G', 'PCS', 'BUNCH', 'PACK'];

  Future<void> _submit() async {
    if (_name.text.trim().length < 2) { setState(() => _error = context.read<Lang>().s.enterName); return; }
    setState(() { _busy = true; _error = null; });
    final s = context.read<Session>();
    try {
      await s.api.submitCatalogRequest(s.store!.id, {
        'type': _type,
        'name': _name.text.trim(),
        if (_type == 'PRODUCT') 'unit': _unit,
        if (_type == 'PRODUCT' && _category.text.trim().isNotEmpty) 'categoryName': _category.text.trim(),
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      });
      setState(() => _done = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() { _name.dispose(); _category.dispose(); _note.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.catalogRequestTitle)),
      body: SafeArea(child: _done ? _success(s) : _form(s)),
    );
  }

  Widget _success(S s) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.check_circle_outline_rounded, size: 64, color: AppColors.leaf),
            const SizedBox(height: 12),
            Text(s.requestSent, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(s.requestSentText,
                textAlign: TextAlign.center, style: const TextStyle(color: AppColors.ink60)),
            const SizedBox(height: 24),
            OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: Text(s.done)),
          ]),
        ),
      );

  Widget _form(S s) => SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.proposeTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'PRODUCT', label: Text(s.product)),
              ButtonSegment(value: 'CATEGORY', label: Text(s.category)),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 16),
          Text(_type == 'PRODUCT' ? s.productName : s.categoryName,
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
          const SizedBox(height: 6),
          TextField(controller: _name, decoration: InputDecoration(
              hintText: _type == 'PRODUCT' ? s.productHint : s.categoryHint)),
          if (_type == 'PRODUCT') ...[
            const SizedBox(height: 16),
            Text(s.unit, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _unit,
              items: _units.map((u) => DropdownMenuItem(value: u, child: Text(unitLabel(s, u)))).toList(),
              onChanged: (v) => setState(() => _unit = v ?? 'KG'),
            ),
            const SizedBox(height: 16),
            Text(s.categoryIfKnown, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
            const SizedBox(height: 6),
            TextField(controller: _category, decoration: InputDecoration(hintText: s.categoryOptHint)),
          ],
          const SizedBox(height: 16),
          Text(s.comment, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
          const SizedBox(height: 6),
          TextField(controller: _note, maxLines: 2, decoration: InputDecoration(hintText: s.optional)),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(_error!, style: const TextStyle(color: AppColors.sale)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _busy ? null : _submit, child: Text(_busy ? s.sending : s.sendApplication)),
        ]),
      );
}
