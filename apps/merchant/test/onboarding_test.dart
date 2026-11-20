import 'package:flutter_test/flutter_test.dart';
import 'package:kartop_merchant/models.dart';
import 'package:kartop_merchant/onboarding_l10n.dart';

void main() {
  test('заявка: разбор ответа API и фото по видам', () {
    final a = StoreApplication.fromJson({
      'id': 's1', 'name': 'Асель', 'slug': 'asel', 'status': 'PENDING', 'legalName': 'ИП Асанов', 'legalBin': '900101300017',
      'state': 'REJECTED', 'applicationRejectReason': 'нечёткое фото', 'productCount': 3,
      'checks': {'data': true, 'bin': true, 'photos': false, 'contract': true}, 'ready': false,
      'documents': [{'id': 'd1', 'kind': 'CONTRACT'}, {'id': 'd2', 'kind': 'CONTRACT'}, {'id': 'd3', 'kind': 'ID_CARD'}],
    });
    expect(a.editable, isTrue);
    expect(a.rejectReason, 'нечёткое фото');
    expect(a.docs('CONTRACT'), ['d1', 'd2']);
    expect(a.docs('SIGN_PHOTO'), isEmpty);
    expect(a.checks['photos'], isFalse);
  });

  test('магазин по заявке до одобрения — экран заявки', () {
    final s = StoreSummary.fromJson({'id': 's1', 'name': 'A', 'status': 'PENDING', 'myRole': 'OWNER', 'selfRegistered': true});
    expect(s.isApplication, isTrue);
    expect(StoreSummary.fromJson({'id': 's2', 'name': 'B', 'status': 'PENDING', 'myRole': 'OWNER'}).isApplication, isFalse);
  });

  test('строки заявки есть на всех языках', () {
    for (final code in ['ru', 'kk', 'tg', 'uz']) {
      final o = OnbS.forCode(code);
      expect(o.products.contains('{n}'), isTrue, reason: code);
      expect(o.tariffBanner.contains('{date}'), isTrue, reason: code);
      expect(o.applyCta, isNotEmpty);
    }
  });
}
