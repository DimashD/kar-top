import 'package:flutter_test/flutter_test.dart';
import 'package:kartop_customer/links.dart';

void main() {
  const base = 'https://kar-top.kz';

  test('свои страницы открываем внутри, чужие — снаружи', () {
    expect(isOwnPage(Uri.parse('https://kar-top.kz/ruslan-fruits'), base: base), isTrue);
    expect(isOwnPage(Uri.parse('https://wa.me/77011234567'), base: base), isFalse);
    expect(isOwnPage(Uri.parse('tel:+77011234567'), base: base), isFalse);
  });

  test('диплинк заказа → страница заказа', () {
    expect(pageForLink(Uri.parse('kartop://order/abc'), base: base).toString(), 'https://kar-top.kz/order/abc');
    expect(pageForLink(Uri.parse('https://kar-top.kz/ruslan-fruits'), base: base).toString(), 'https://kar-top.kz/ruslan-fruits');
    expect(pageForLink(Uri.parse('https://example.com/x'), base: base), isNull);
  });

  test('запоминаем только витрину магазина', () {
    expect(shopSlugOf(Uri.parse('https://kar-top.kz/ruslan-fruits'), base: base), 'ruslan-fruits');
    expect(shopSlugOf(Uri.parse('https://kar-top.kz/order/abc'), base: base), isNull);
    expect(shopSlugOf(Uri.parse('https://kar-top.kz/partner'), base: base), isNull);
    expect(shopSlugOf(Uri.parse('https://kar-top.kz/'), base: base), isNull);
  });
}
