import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'catalog_request_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  late Future<List<CatalogItem>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final s = context.read<Session>();
    _future = s.api.catalog(s.store!.id);
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

  Widget _proposeButton(S s) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: OutlinedButton.icon(
          onPressed: () async {
            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CatalogRequestScreen()));
            if (mounted) setState(_load);
          },
          icon: const Icon(Icons.add),
          label: Text(s.proposeItem),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return RefreshIndicator(
      onRefresh: () async { setState(_load); await _future; },
      child: FutureBuilder<List<CatalogItem>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) return ListView(children: [Padding(padding: const EdgeInsets.all(24), child: Text('${snap.error}', style: const TextStyle(color: AppColors.sale)))]);
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return ListView(padding: const EdgeInsets.all(16), children: [
              _proposeButton(s),
              Padding(padding: const EdgeInsets.all(40), child: Center(child: Text(s.catalogEmpty, style: const TextStyle(color: AppColors.ink60)))),
            ]);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length + 1,
            itemBuilder: (context, idx) {
              if (idx == 0) return _proposeButton(s);
              final i = idx - 1;
              final it = items[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(it.localName(s), style: const TextStyle(fontWeight: FontWeight.w700)),
                            GestureDetector(
                              onTap: () => _editPrice(it),
                              child: Row(children: [
                                Text(tenge(it.priceTiyn), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                                const SizedBox(width: 4),
                                const Icon(Icons.edit, size: 14, color: AppColors.ink40),
                              ]),
                            ),
                          ],
                        ),
                      ),
                      Switch(value: it.inStock, activeThumbColor: AppColors.leaf, onChanged: (v) => _toggleStock(it, v)),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

extension on CatalogItem {
  bool get weightedUnit => unit == 'KG' || unit == 'G';
  /// Название на языке интерфейса (в каталоге есть ru и kk), иначе по-русски.
  String localName(S s) => names[s.code] as String? ?? name;
}
