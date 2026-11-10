import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../phone.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/language_picker.dart';
import 'partner_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController(text: '+7');
  final _code = TextEditingController();
  bool _sent = false;
  bool _busy = false;
  String? _error;

  Future<void> _request() async {
    setState(() { _busy = true; _error = null; });
    try {
      await context.read<Session>().api.requestOtp(kzPhoneE164(_phone.text));
      setState(() => _sent = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() { _busy = true; _error = null; });
    final session = context.read<Session>();
    try {
      final (token, refresh) = await session.api.verifyOtp(kzPhoneE164(_phone.text), _code.text.trim());
      await session.setToken(token, refresh);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const Align(alignment: Alignment.topRight, child: Padding(padding: EdgeInsets.all(8), child: LanguageButton())),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Kartop', style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.carrot)),
                    const SizedBox(height: 4),
                    Text(s.merchantCabinet, style: const TextStyle(fontSize: 16, color: AppColors.ink60)),
                    const SizedBox(height: 32),
                    if (!_sent) ...[
                      Text(s.phone, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink60)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [KzPhoneFormatter()],
                        decoration: const InputDecoration(hintText: '+7 701 123 45 67'),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _busy ? null : _request, child: Text(_busy ? s.sending : s.getCode)),
                    ] else ...[
                      Text(s.codeSentTo(formatKzPhone(_phone.text)), style: const TextStyle(color: AppColors.ink60)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _code,
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 8),
                        decoration: const InputDecoration(hintText: '••••••'),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _busy ? null : _verify, child: Text(_busy ? s.checking : s.signIn)),
                      TextButton(onPressed: _busy ? null : () => setState(() => _sent = false), child: Text(s.changeNumber)),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: AppColors.sale)),
                    ],
                    if (!_sent) ...[
                      const SizedBox(height: 24),
                      const Divider(),
                      const SizedBox(height: 8),
                      Text(s.notPartnerYet,
                          textAlign: TextAlign.center, style: const TextStyle(color: AppColors.ink60)),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _busy
                            ? null
                            : () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const PartnerScreen())),
                        child: Text(s.becomePartner),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
