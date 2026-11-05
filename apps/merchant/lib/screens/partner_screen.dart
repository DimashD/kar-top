import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../phone.dart';
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
    return _name.text.trim().length >= 2 && isValidKzPhone(_phone.text);
  }

  Future<void> _submit() async {
    if (!_valid) return;
    setState(() { _busy = true; _error = null; });
    try {
      await context.read<Session>().api.applyPartner(
            name: _name.text.trim(),
            phone: kzPhoneE164(_phone.text),
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
    final s = S.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.becomePartner)),
      body: SafeArea(
        child: _done ? _success(s) : _form(s),
      ),
    );
  }

  Widget _success(S s) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('✅', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              Text(s.applicationAccepted, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(
                s.partnerSuccessText,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.ink60, fontSize: 15),
              ),
              const SizedBox(height: 24),
              OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: Text(s.backToLogin)),
            ],
          ),
        ),
      );

  Widget _form(S s) => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(s.partnerTitle, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              s.partnerIntro,
              style: const TextStyle(color: AppColors.ink60, fontSize: 15),
            ),
            const SizedBox(height: 24),
            _label(s, s.yourName, required: true),
            TextField(controller: _name, textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(hintText: s.yourNameHint),
              onChanged: (_) => setState(() {})),
            const SizedBox(height: 16),
            _label(s, s.phone, required: true),
            TextField(controller: _phone, keyboardType: TextInputType.phone,
              inputFormatters: [KzPhoneFormatter()],
              decoration: const InputDecoration(hintText: '+7 701 123 45 67'),
              onChanged: (_) => setState(() {})),
            const SizedBox(height: 16),
            _label(s, s.companyName, required: false),
            TextField(controller: _company, decoration: InputDecoration(hintText: s.companyHint)),
            const SizedBox(height: 16),
            _label(s, s.twogisLink, required: false),
            TextField(controller: _twogis, keyboardType: TextInputType.url,
              decoration: const InputDecoration(hintText: '2gis.kz/almaty/firm/…')),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: const TextStyle(color: AppColors.sale)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: (_busy || !_valid) ? null : _submit,
              child: Text(_busy ? s.sending : s.sendApplication),
            ),
            const SizedBox(height: 10),
            Text(
              s.consent,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.ink40, fontSize: 12),
            ),
          ],
        ),
      );

  Widget _label(S s, String text, {required bool required}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: RichText(
          text: TextSpan(
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60, fontSize: 14),
            children: [
              TextSpan(text: text),
              if (required) const TextSpan(text: ' *', style: TextStyle(color: AppColors.sale)),
              if (!required) TextSpan(text: s.optionalSuffix, style: const TextStyle(fontWeight: FontWeight.w400, color: AppColors.ink40)),
            ],
          ),
        ),
      );
}
