import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config.dart';
import '../l10n.dart';
import '../session.dart';

Future<void> _openDoc(BuildContext context, String path) async {
  final messenger = ScaffoldMessenger.of(context);
  final s = context.read<Lang>().s;
  final ok = await launchUrl(Uri.parse('$kWebBase$path'), mode: LaunchMode.externalApplication).catchError((_) => false);
  if (!ok) messenger.showSnackBar(SnackBar(content: Text(s.cannotOpen)));
}

/// Согласие сотрудника на обработку ПДн и соглашение — отдельная отметка, не предотмечена.
class ConsentView extends StatefulWidget {
  final VoidCallback onDone;
  const ConsentView({super.key, required this.onDone});
  @override
  State<ConsentView> createState() => _ConsentViewState();
}

class _ConsentViewState extends State<ConsentView> {
  bool _agree = false;
  bool _busy = false;
  String? _err;

  Future<void> _accept() async {
    setState(() { _busy = true; _err = null; });
    try {
      await context.read<Session>().api.acceptDocs();
      widget.onDone();
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text(s.consentTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 16),
      CheckboxListTile(
        value: _agree,
        onChanged: (v) => setState(() => _agree = v ?? false),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
        title: Text(s.consentAgree),
        subtitle: Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => _openDoc(context, '/consent'), child: Text(s.readDoc))),
      ),
      Text(s.consentTerms, style: Theme.of(context).textTheme.bodySmall),
      Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => _openDoc(context, '/terms'), child: Text(s.readDoc))),
      const SizedBox(height: 12),
      FilledButton(onPressed: _agree && !_busy ? _accept : null, child: Text(s.consentContinue)),
      if (_err != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
    ]);
  }
}

/// Владелец принимает оферту: реквизиты ИП/ТОО и ИИН/БИН, затем код из SMS на его номер.
class ContractView extends StatefulWidget {
  final String storeId;
  final VoidCallback onDone;
  const ContractView({super.key, required this.storeId, required this.onDone});
  @override
  State<ContractView> createState() => _ContractViewState();
}

class _ContractViewState extends State<ContractView> {
  final _name = TextEditingController();
  final _bin = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _name.dispose();
    _bin.dispose();
    _code.dispose();
    super.dispose();
  }

  bool get _valid => _name.text.trim().length >= 3 && RegExp(r'^\d{12}$').hasMatch(_bin.text);

  Future<void> _run(Future<void> Function() f) async {
    setState(() { _busy = true; _err = null; });
    try {
      await f();
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final api = context.read<Session>().api;
    return ListView(padding: const EdgeInsets.all(20), children: [
      Text(s.contractTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 10),
      Text(s.contractIntro),
      const SizedBox(height: 8),
      Text(s.contractPoints, style: const TextStyle(height: 1.5)),
      Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => _openDoc(context, '/merchant-offer'), child: Text(s.contractFullText))),
      const SizedBox(height: 8),
      TextField(
        controller: _name, enabled: !_codeSent,
        decoration: InputDecoration(labelText: s.contractLegalName, border: const OutlineInputBorder()),
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _bin, enabled: !_codeSent, keyboardType: TextInputType.number, maxLength: 12,
        decoration: InputDecoration(labelText: s.contractBin, border: const OutlineInputBorder()),
        onChanged: (_) => setState(() {}),
      ),
      if (!_codeSent)
        FilledButton(
          onPressed: _valid && !_busy ? () => _run(() async { await api.requestOfferCode(widget.storeId); setState(() => _codeSent = true); }) : null,
          child: Text(s.contractAccept),
        )
      else ...[
        Text(s.contractCodeSent),
        const SizedBox(height: 10),
        TextField(
          controller: _code, keyboardType: TextInputType.number, maxLength: 6, autofocus: true,
          decoration: const InputDecoration(border: OutlineInputBorder(), counterText: ''),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        FilledButton(
          onPressed: _code.text.length == 6 && !_busy
              ? () => _run(() async {
                    final messenger = ScaffoldMessenger.of(context);
                    await api.acceptOffer(widget.storeId, _name.text.trim(), _bin.text, _code.text);
                    messenger.showSnackBar(SnackBar(content: Text(s.contractDone)));
                    widget.onDone();
                  })
              : null,
          child: Text(s.contractSign),
        ),
      ],
      if (_err != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
    ]);
  }
}
