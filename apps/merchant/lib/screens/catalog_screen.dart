import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'catalog_request_screen.dart';

enum _Stock { all, inStock, hidden }

/// Ассортимент магазина: поиск с подсказками, категории-чипы, фильтр по наличию,
/// список по категориям. Цена и наличие меняются прямо в карточке.
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List<CatalogItem>? _items;
  String? _error;
  String? _category; // null — все категории
  _Stock _stock = _Stock.all;
  String _query = '';
  final _search = SearchController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final s = context.read<Session>();
    try {
      final items = await s.api.catalog(s.store!.id);
      if (mounted) setState(() { _items = items; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _toggleStock(CatalogItem it, bool v) async {
    final s = context.read<Session>();
    final messenger = ScaffoldMessenger.of(context);
    setState(() => it.inStock = v);
    try {
      await s.api.updateProduct(s.store!.id, it.id, {'inStock': v});
    } catch (e) {
      setState(() => it.inStock = !v);
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _editPrice(CatalogItem it) async {
    final session = context.read<Session>();
    final s = context.read<Lang>().s;
    final messenger = ScaffoldMessenger.of(context);
    final ctrl = TextEditingController(text: (it.priceTiyn ~/ 100).toString());
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(it.localName(s)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(suffixText: '₸', labelText: it.weightedUnit ? s.pricePerKg : s.pricePerPcs),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.cancel)),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)), child: Text(s.save)),
        ],
      ),
    );
    if (result != null && result > 0) {
      final tiyn = result * 100;
      setState(() => it.priceTiyn = tiyn);
      try {
        await session.api.updateProduct(session.store!.id, it.id, {'priceTiyn': tiyn});
      } catch (e) {
        messenger.showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  /// Нормализация для поиска: регистр, ё → е.
  static String _norm(String v) => v.toLowerCase().replaceAll('ё', 'е');

  /// Совпадение по всем словам запроса — в названии на любом языке или в категории.
  /// 0 — нет совпадения, 2 — название начинается с запроса, 1 — просто содержит.
  int _match(CatalogItem it, String q) {
    final words = _norm(q).split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return 1;
    final hay = _norm([...it.names.values, ...it.categoryNames.values, it.name].whereType<String>().join(' '));
    if (!words.every(hay.contains)) return 0;
    final s = context.read<Lang>().s;
    return _norm(it.localName(s)).startsWith(words.first) ? 2 : 1;
  }

  List<CatalogItem> _searchResults(String q) {
    final items = _items ?? [];
    final scored = [for (final it in items) (it, _match(it, q))].where((e) => e.$2 > 0).toList()
      ..sort((a, b) => b.$2.compareTo(a.$2));
    return scored.map((e) => e.$1).toList();
  }

  String _catName(S s, CatalogItem it) =>
      (it.categoryNames[s.code] ?? it.categoryNames['ru']) as String? ?? s.otherCategory;

  Future<void> _quickEdit(CatalogItem it) async {
    final s = context.read<Lang>().s;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(it.localName(s), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                Text(_catName(s, it), style: const TextStyle(color: AppColors.ink40)),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(it.weightedUnit ? s.pricePerKg : s.pricePerPcs),
                  trailing: Text(tenge(it.priceTiyn), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                  onTap: () async {
                    await _editPrice(it);
                    setSheet(() {});
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: it.inStock,
                  activeThumbColor: AppColors.leaf,
                  title: Text(s.inStockLabel),
                  onChanged: (v) async {
                    await _toggleStock(it, v);
                    setSheet(() {});
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final items = _items;
    if (items == null) {
      return _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(color: AppColors.sale))))
          : const Center(child: CircularProgressIndicator());
    }

    // Категории с количеством товаров — для чипов.
    final cats = <String, (String, int)>{};
    for (final it in items) {
      final prev = cats[it.categoryId];
      cats[it.categoryId] = (_catName(s, it), (prev?.$2 ?? 0) + 1);
    }
    final catList = cats.entries.toList()..sort((a, b) => a.value.$1.compareTo(b.value.$1));

    final visible = (_query.isEmpty ? items : _searchResults(_query)).where((it) {
      if (_category != null && it.categoryId != _category) return false;
      if (_stock == _Stock.inStock && !it.inStock) return false;
      if (_stock == _Stock.hidden && it.inStock) return false;
      return true;
    }).toList();

    // Группировка по категориям (внутри — по алфавиту); при поиске порядок — по релевантности.
    final groups = <String, List<CatalogItem>>{};
    for (final it in visible) {
      groups.putIfAbsent(it.categoryId, () => []).add(it);
    }
    final groupKeys = groups.keys.toList()..sort((a, b) => cats[a]!.$1.compareTo(cats[b]!.$1));

    return Column(
      children: [
        Container(
          color: AppColors.card,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            children: [
              SearchAnchor.bar(
                searchController: _search,
                barHintText: s.searchProducts,
                barElevation: const WidgetStatePropertyAll(0),
                barBackgroundColor: const WidgetStatePropertyAll(AppColors.bg),
                viewHintText: s.searchProducts,
                onSubmitted: (q) {
                  setState(() => _query = q.trim());
                  _search.closeView(q);
                },
                suggestionsBuilder: (ctx, controller) {
                  final q = controller.text.trim();
                  if (q.isEmpty) return const <Widget>[];
                  final found = _searchResults(q).take(8).toList();
                  if (found.isEmpty) {
                    return [ListTile(title: Text(s.nothingFound, style: const TextStyle(color: AppColors.ink40)))];
                  }
                  return found.map((it) => ListTile(
                        leading: Icon(it.inStock ? Icons.check_circle : Icons.visibility_off_outlined,
                            color: it.inStock ? AppColors.leaf : AppColors.ink40),
                        title: Text(it.localName(s), style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(_catName(s, it)),
                        trailing: Text(tenge(it.priceTiyn), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                        onTap: () {
                          controller.closeView('');
                          FocusScope.of(context).unfocus();
                          _quickEdit(it);
                        },
                      ));
                },
              ),
              if (_query.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: InputChip(
                      label: Text('«$_query»'),
                      onDeleted: () {
                        _search.clear();
                        setState(() => _query = '');
                      },
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _catChip('${s.all} · ${items.length}', _category == null, () => setState(() => _category = null)),
                    for (final c in catList)
                      _catChip('${c.value.$1} · ${c.value.$2}', _category == c.key, () => setState(() => _category = c.key)),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: SegmentedButton<_Stock>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(value: _Stock.all, label: Text(s.all)),
                    ButtonSegment(value: _Stock.inStock, label: Text(s.inStockFilter)),
                    ButtonSegment(value: _Stock.hidden, label: Text(s.hiddenFilter)),
                  ],
                  selected: {_stock},
                  onSelectionChanged: (v) => setState(() => _stock = v.first),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                if (items.isEmpty)
                  Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.catalogEmpty, style: const TextStyle(color: AppColors.ink60))))
                else if (visible.isEmpty)
                  Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.nothingFound, style: const TextStyle(color: AppColors.ink60)))),
                for (final key in groupKeys) ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 6, bottom: 8),
                    child: Text(cats[key]!.$1.toUpperCase(),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.ink40, letterSpacing: 0.6)),
                  ),
                  for (final it in groups[key]!) _productCard(s, it),
                ],
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CatalogRequestScreen()));
                    if (mounted) await _load();
                  },
                  icon: const Icon(Icons.add),
                  label: Text(s.proposeItem),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _catChip(String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => onTap(),
          showCheckmark: false,
          selectedColor: AppColors.carrot50,
          labelStyle: TextStyle(fontWeight: FontWeight.w700, color: selected ? AppColors.carrot600 : AppColors.ink60),
        ),
      );

  Widget _productCard(S s, CatalogItem it) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _editPrice(it),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(it.localName(s),
                          style: TextStyle(fontWeight: FontWeight.w700, color: it.inStock ? AppColors.ink : AppColors.ink40)),
                      const SizedBox(height: 2),
                      Row(children: [
                        Text(tenge(it.priceTiyn), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                        Text(' / ${unitLabel(s, it.unit == 'G' ? 'KG' : it.unit)}', style: const TextStyle(color: AppColors.ink40)),
                        const SizedBox(width: 6),
                        const Icon(Icons.edit, size: 14, color: AppColors.ink40),
                      ]),
                    ],
                  ),
                ),
                Switch(value: it.inStock, activeThumbColor: AppColors.leaf, onChanged: (v) => _toggleStock(it, v)),
              ],
            ),
          ),
        ),
      );
}

extension on CatalogItem {
  bool get weightedUnit => unit == 'KG' || unit == 'G';
  /// Название на языке интерфейса (в каталоге есть ru и kk), иначе по-русски.
  String localName(S s) => names[s.code] as String? ?? name;
}
