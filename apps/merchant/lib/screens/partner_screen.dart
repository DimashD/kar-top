import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';

/// Заявка «Стать партнёром». Открывается с экрана входа (регистрация магазинов — по приглашению).
/// Телефон и имя — обязательны; название компании и 2ГИС — нет.
class PartnerScreen extends StatefulWidget {
  const PartnerScreen({super.key});
  @override
  State<PartnerScreen> createState() => _PartnerScreenState();
}

class _PartnerScreenState extends State<PartnerScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController(text: '+7');
  final _company = TextEditingController();
  final _twogis = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;

  bool get _valid {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    final phoneOk = RegExp(r'^(7|8)7\d{9}$').hasMatch(digits);
    return _name.text.trim().length >= 2 && phoneOk;
  }

  Future<void> _submit() async {
    if (!_valid) return;
    setState(() { _busy = true; _error = null; });
    try {
      await context.read<Session>().api.applyPartner(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            company: _company.text.trim(),
            twogisUrl: _twogis.text.trim(),
          );
      setState(() => _done = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _name.dispose(); _phone.dispose(); _company.dispose(); _twogis.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Стать партнёром')),
      body: SafeArea(
        child: _done ? _success() : _form(),
      ),
    );
  }

  Widget _success() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('✅', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              const Text('Заявка принята!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text(
                'Мы свяжемся с вами по телефону, чтобы подключить магазин к Kartop. Обычно в течение рабочего дня.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.ink60, fontSize: 15),
              ),
              const SizedBox(height: 24),
              OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Назад ко входу')),
            ],
          ),
        ),
      );

  Widget _form() => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Выведите магазин в онлайн', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text(
              'Оставьте контакты — поможем подключить ваш магазин к Kartop. Подключение по приглашению.',
              style: TextStyle(color: AppColors.ink60, fontSize: 15),
            ),
            const SizedBox(height: 24),
            _label('Ваше имя', required: true),
            TextField(controller: _name, textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(hintText: 'Как к вам обращаться'),
              onChanged: (_) => setState(() {})),
            const SizedBox(height: 16),
            _label('Телефон', required: true),
            TextField(controller: _phone, keyboardType: TextInputType.phone,
              decoration: const InputDecoration(hintText: '+77011234567'),
              onChanged: (_) => setState(() {})),
            const SizedBox(height: 16),
            _label('Название компании', required: false),
            TextField(controller: _company, decoration: const InputDecoration(hintText: 'Напр. «Фрукты у Руслана»')),
            const SizedBox(height: 16),
            _label('Ссылка на 2ГИС', required: false),
            TextField(controller: _twogis, keyboardType: TextInputType.url,
              decoration: const InputDecoration(hintText: '2gis.kz/almaty/firm/…')),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: const TextStyle(color: AppColors.sale)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: (_busy || !_valid) ? null : _submit,
              child: Text(_busy ? 'Отправляем…' : 'Отправить заявку'),
            ),
            const SizedBox(height: 10),
            const Text(
              'Нажимая кнопку, вы соглашаетесь на обработку контактных данных для связи.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.ink40, fontSize: 12),
            ),
          ],
        ),
      );

  Widget _label(String text, {required bool required}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: RichText(
          text: TextSpan(
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60, fontSize: 14),
            children: [
              TextSpan(text: text),
              if (required) const TextSpan(text: ' *', style: TextStyle(color: AppColors.sale)),
              if (!required) const TextSpan(text: ' — необязательно', style: TextStyle(fontWeight: FontWeight.w400, color: AppColors.ink40)),
            ],
          ),
        ),
      );
}
