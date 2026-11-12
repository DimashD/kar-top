/// Допуск при взвешивании — та же формула, что на сервере (apps/api/src/modules/ordering/weight-tolerance.ts):
/// перевес не более +10 % (максимум +300 г), недовес до −20 %, в обе стороны не меньше 20 г.
({int minG, int maxG}) weightRange(int requestedG) {
  final over = (requestedG * 0.1).round().clamp(20, 300).toInt();
  final under = (requestedG * 0.2).round() < 20 ? 20 : (requestedG * 0.2).round();
  final min = requestedG - under;
  return (minG: min < 1 ? 1 : min, maxG: requestedG + over);
}
