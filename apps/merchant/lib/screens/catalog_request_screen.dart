import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

  static const _units = {'KG': 'кг', 'G': 'г', 'PCS': 'шт', 'BUNCH': 'пучок', 'PACK': 'упак.'};

  Future<void> _submit() async {
    if (_name.text.trim().length < 2) { setState(() => _error = 'Укажите название'); return; }
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
    return Scaffold(
      appBar: AppBar(title: const Text('Заявка в каталог')),
      body: SafeArea(child: _done ? _success() : _form()),
    );
  }

  Widget _success() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('✅', style: TextStyle(fontSize: 56)),
            const SizedBox(height: 12),
            const Text('Заявка отправлена!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Платформа рассмотрит её. После одобрения позиция появится в каталоге, и вы сможете добавить её в свой ассортимент.',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.ink60)),
            const SizedBox(height: 24),
            OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Готово')),
          ]),
        ),
      );

  Widget _form() => SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Предложите позицию для общего каталога', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'PRODUCT', label: Text('Товар')),
              ButtonSegment(value: 'CATEGORY', label: Text('Категория')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 16),
          Text(_type == 'PRODUCT' ? 'Название товара' : 'Название категории',
              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
          const SizedBox(height: 6),
          TextField(controller: _name, decoration: InputDecoration(
              hintText: _type == 'PRODUCT' ? 'Напр. «Яблоко Фуджи»' : 'Напр. «Орехи»')),
          if (_type == 'PRODUCT') ...[
            const SizedBox(height: 16),
            const Text('Единица измерения', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _unit,
              items: _units.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
              onChanged: (v) => setState(() => _unit = v ?? 'KG'),
            ),
            const SizedBox(height: 16),
            const Text('Категория (если знаете)', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
            const SizedBox(height: 6),
            TextField(controller: _category, decoration: const InputDecoration(hintText: 'Напр. «Яблоки» — необязательно')),
          ],
          const SizedBox(height: 16),
          const Text('Комментарий', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
          const SizedBox(height: 6),
          TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(hintText: 'Необязательно')),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(_error!, style: const TextStyle(color: AppColors.sale)),
          ],
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Отправляем…' : 'Отправить заявку')),
        ]),
      );
}
