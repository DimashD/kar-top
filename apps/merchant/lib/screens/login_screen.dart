import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../phone.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/language_picker.dart';
import 'partner_screen.dart';

/// Вход магазина. Обычно — номер и пароль (без SMS). Первый вход или забыли пароль — по коду,
/// после кода магазин придумывает пароль (при первом входе — обязательно).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _Step { password, phoneForCode, code, newPassword }

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController(text: '+7');
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _new1 = TextEditingController();
  final _new2 = TextEditingController();
  _Step _step = _Step.password;
  bool _busy = false;
  bool _mustSetPassword = false;
  String? _error;
  // Токены после входа по коду — сохраняем в сессию, когда пароль придуман (или пропущен).
  (String, String?)? _pending;

  Future<void> _run(Future<void> Function() f) async {
    setState(() { _busy = true; _error = null; });
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loginPassword() => _run(() async {
        final session = context.read<Session>();
        final (token, refresh) = await session.api.loginPassword(kzPhoneE164(_phone.text), _password.text);
        await session.setToken(token, refresh);
      });

  Future<void> _request() => _run(() async {
        await context.read<Session>().api.requestOtp(kzPhoneE164(_phone.text));
        setState(() => _step = _Step.code);
      });

  Future<void> _verify() => _run(() async {
        final api = context.read<Session>().api;
        final pair = await api.verifyOtp(kzPhoneE164(_phone.text), _code.text.trim());
        api.token = pair.$1;
        _pending = pair;
        final has = await api.hasPassword();
        setState(() { _mustSetPassword = !has; _step = _Step.newPassword; });
      });

  Future<void> _savePassword() async {
    final s = S.of(context);
    if (_new1.text != _new2.text) {
      setState(() => _error = s.passwordsDiffer);
      return;
    }
    await _run(() async {
      final session = context.read<Session>();
      await session.api.setPassword(_new1.text);
      await session.setToken(_pending!.$1, _pending!.$2);
    });
  }

  Future<void> _skip() async {
    final session = context.read<Session>();
    await session.setToken(_pending!.$1, _pending!.$2);
  }

  Widget _phoneField(S s) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(s.phone, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
        const SizedBox(height: 6),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          inputFormatters: [KzPhoneFormatter()],
          autofillHints: const [AutofillHints.telephoneNumber],
          decoration: const InputDecoration(hintText: '+7 701 123 45 67'),
        ),
      ]);

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final children = <Widget>[];
    switch (_step) {
      case _Step.password:
        children.addAll([
          _phoneField(s),
          const SizedBox(height: 12),
          Text(s.passwordLabel, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
          const SizedBox(height: 6),
          TextField(controller: _password, obscureText: true, autofillHints: const [AutofillHints.password], onSubmitted: (_) => _loginPassword()),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _busy ? null : _loginPassword, child: Text(_busy ? s.checking : s.signIn)),
          TextButton(onPressed: _busy ? null : () => setState(() { _step = _Step.phoneForCode; _error = null; }), child: Text(s.signInWithCode, textAlign: TextAlign.center)),
        ]);
      case _Step.phoneForCode:
        children.addAll([
          _phoneField(s),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _busy ? null : _request, child: Text(_busy ? s.sending : s.getCode)),
          TextButton(onPressed: _busy ? null : () => setState(() { _step = _Step.password; _error = null; }), child: Text(s.signInWithPassword)),
        ]);
      case _Step.code:
        children.addAll([
          Text(s.codeSentTo(formatKzPhone(_phone.text)), style: const TextStyle(color: AppColors.ink60)),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            autofillHints: const [AutofillHints.oneTimeCode],
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 8),
            decoration: const InputDecoration(hintText: '••••••'),
          ),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _busy ? null : _verify, child: Text(_busy ? s.checking : s.signIn)),
          TextButton(onPressed: _busy ? null : () => setState(() => _step = _Step.phoneForCode), child: Text(s.changeNumber)),
        ]);
      case _Step.newPassword:
        children.addAll([
          Text(s.createPassword, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(s.createPasswordHint, style: const TextStyle(color: AppColors.ink60)),
          const SizedBox(height: 12),
          TextField(controller: _new1, obscureText: true, autofillHints: const [AutofillHints.newPassword], decoration: InputDecoration(hintText: s.passwordLabel)),
          const SizedBox(height: 8),
          TextField(controller: _new2, obscureText: true, autofillHints: const [AutofillHints.newPassword], decoration: InputDecoration(hintText: s.repeatPassword)),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _busy ? null : _savePassword, child: Text(_busy ? s.checking : s.saveAndSignIn)),
          if (!_mustSetPassword) TextButton(onPressed: _busy ? null : _skip, child: Text(s.skipStep)),
        ]);
    }

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const Align(alignment: Alignment.topRight, child: Padding(padding: EdgeInsets.all(8), child: LanguageButton())),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: AutofillGroup(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Kartop', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.carrot)),
                      const SizedBox(height: 4),
                      Text(s.merchantCabinet, style: const TextStyle(fontSize: 16, color: AppColors.ink60)),
                      const SizedBox(height: 32),
                      ...children,
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: AppColors.sale)),
                      ],
                      if (_step == _Step.password) ...[
                        const SizedBox(height: 24),
                        const Divider(),
                        const SizedBox(height: 8),
                        Text(s.notPartnerYet, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.ink60)),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: _busy ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PartnerScreen())),
                          child: Text(s.becomePartner),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
