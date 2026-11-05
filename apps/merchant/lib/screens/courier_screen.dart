import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../format.dart';
import '../l10n.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';

/// Экран курьера: курьер вводит код, названный клиентом, — заказ закрывается.
class CourierScreen extends StatefulWidget {
  final OrderDetail order;
  const CourierScreen({super.key, required this.order});
  @override
  State<CourierScreen> createState() => _CourierScreenState();
}

class _CourierScreenState extends State<CourierScreen> {
  String _code = '';
  bool _busy = false;
  bool _error = false;
  bool _done = false;

  void _tap(String d) {
    if (_busy || _code.length >= 4) return;
    setState(() { _code += d; _error = false; });
    if (_code.length == 4) _submit();
  }

  void _back() {
    if (_code.isEmpty) return;
    setState(() { _code = _code.substring(0, _code.length - 1); _error = false; });
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await context.read<Session>().api.delivered(widget.order.id, _code);
      setState(() => _done = true);
    } catch (e) {
      setState(() { _error = true; _code = ''; });
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final o = widget.order;
    return Scaffold(
      appBar: AppBar(title: Text(s.handoverNo(o.number))),
      body: _done ? _success(s, o) : _entry(s, o),
    );
  }

  Widget _entry(S s, OrderDetail o) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const SizedBox(height: 8),
            Text(s.askCode, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800), textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(s.askCodeHint,
                style: const TextStyle(color: AppColors.ink60), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final filled = i < _code.length;
                return Container(
                  width: 58, height: 70,
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: _error ? AppColors.sale : (filled ? AppColors.carrot : AppColors.line), width: 2),
                  ),
                  alignment: Alignment.center,
                  child: Text(filled ? _code[i] : '', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
                );
              }),
            ),
            if (_error) Padding(padding: const EdgeInsets.only(top: 12), child: Text(s.wrongCode, style: const TextStyle(color: AppColors.sale))),
            const Spacer(),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.carrot50, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Text(s.takePayment, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text('${tenge(o.finalTiyn ?? o.subtotalTiyn)} · ${payLabel(s, o.payMethod)}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.carrot600)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _keypad(),
          ],
        ),
      ),
    );
  }

  Widget _keypad() {
    final keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.9,
      children: keys.map((k) {
        if (k.isEmpty) return const SizedBox.shrink();
        return InkWell(
          onTap: () => k == '⌫' ? _back() : _tap(k),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.line)),
            alignment: Alignment.center,
            child: Text(k, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          ),
        );
      }).toList(),
    );
  }

  Widget _success(S s, OrderDetail o) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 92, height: 92,
              decoration: const BoxDecoration(color: AppColors.leaf50, shape: BoxShape.circle),
              child: const Icon(Icons.check, color: AppColors.leaf, size: 48),
            ),
            const SizedBox(height: 16),
            Text(s.orderHandedOver, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text(s.handedOverText(tenge(o.finalTiyn ?? o.subtotalTiyn)),
                style: const TextStyle(color: AppColors.ink60), textAlign: TextAlign.center),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.leaf),
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(s.done),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
