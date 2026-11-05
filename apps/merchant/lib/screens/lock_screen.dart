import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n.dart';
import '../lock.dart';
import '../session.dart';
import '../theme.dart';

/// Экран блокировки: биометрия или PIN. Вызывается на холодном старте/возврате,
/// если замок включён. onUnlocked — когда доступ подтверждён.
class LockScreen extends StatefulWidget {
  final VoidCallback onUnlocked;
  const LockScreen({super.key, required this.onUnlocked});
  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  String _pin = '';
  bool _error = false;
  bool _bioAvailable = false;

  @override
  void initState() {
    super.initState();
    _tryBiometric();
  }

  Future<void> _tryBiometric() async {
    final ok = await AppLock.biometricAvailable();
    if (mounted) setState(() => _bioAvailable = ok);
    if (!mounted) return;
    final reason = context.read<Lang>().s.biometricReason;
    if (ok && await AppLock.authenticateBiometric(reason)) widget.onUnlocked();
  }

  Future<void> _tap(String d) async {
    if (_pin.length >= 4) return;
    setState(() { _pin += d; _error = false; });
    if (_pin.length == 4) {
      if (await AppLock.verifyPin(_pin)) {
        widget.onUnlocked();
      } else {
        setState(() { _error = true; _pin = ''; });
      }
    }
  }

  void _back() {
    if (_pin.isNotEmpty) setState(() { _pin = _pin.substring(0, _pin.length - 1); _error = false; });
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              const Text('Kartop', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: AppColors.carrot)),
              const SizedBox(height: 6),
              Text(s.enterPin, style: const TextStyle(color: AppColors.ink60)),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (i) {
                  final filled = i < _pin.length;
                  return Container(
                    width: 16, height: 16,
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: filled ? AppColors.carrot : Colors.transparent,
                      border: Border.all(color: _error ? AppColors.sale : AppColors.carrot, width: 2),
                    ),
                  );
                }),
              ),
              if (_error) Padding(padding: const EdgeInsets.only(top: 12), child: Text(s.wrongPin, style: const TextStyle(color: AppColors.sale))),
              const Spacer(),
              _keypad(),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.read<Session>().logout(),
                child: Text(s.forgotPin),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _keypad() {
    final keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', _bioAvailable ? 'bio' : '', '0', '⌫'];
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.7,
      children: keys.map((k) {
        if (k.isEmpty) return const SizedBox.shrink();
        if (k == 'bio') {
          return InkWell(onTap: _tryBiometric, borderRadius: BorderRadius.circular(14), child: const Icon(Icons.fingerprint, size: 32, color: AppColors.carrot));
        }
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
}
