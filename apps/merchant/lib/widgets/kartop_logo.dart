import 'package:material_ui/material_ui.dart';

import '../theme.dart';

/// Логотип Kartop: корзинка с фруктами (как иконка приложения) + «Kartop».
class KartopLogo extends StatelessWidget {
  const KartopLogo({super.key, this.size = 28, this.showWord = true});

  /// Высота надписи; значок чуть крупнее.
  final double size;
  final bool showWord;

  @override
  Widget build(BuildContext context) {
    final mark = SizedBox.square(dimension: size * 1.15, child: const CustomPaint(painter: _BasketPainter()));
    if (!showWord) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.22),
        Text('Kartop', style: TextStyle(fontSize: size * 0.86, fontWeight: FontWeight.w900, color: AppColors.carrot, height: 1)),
      ],
    );
  }
}

/// Рисунок в координатах 80×80 (как SVG-логотип сайта, viewBox 10 16 80 80).
class _BasketPainter extends CustomPainter {
  const _BasketPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 80, size.height / 80);
    canvas.translate(-10, -16);
    Paint fill(int c) => Paint()..color = Color(c);
    canvas.drawCircle(const Offset(36, 46), 13, fill(0xFFD9531E));
    canvas.drawCircle(const Offset(51, 43), 12, fill(0xFFE8893A));
    canvas.drawCircle(const Offset(62, 49), 10.5, fill(0xFFC0392B));
    canvas.drawPath(Path()..moveTo(50, 20)..cubicTo(42, 24, 41, 35, 46, 41)..cubicTo(52, 36, 53, 27, 50, 20)..close(), fill(0xFF3E7D53));
    canvas.drawPath(Path()..moveTo(47, 40)..cubicTo(55, 31, 66, 30, 72, 34)..cubicTo(64, 41, 55, 42, 47, 40)..close(), fill(0xFF4F8F60));
    canvas.drawRRect(RRect.fromLTRBR(18, 52, 82, 62, const Radius.circular(5)), fill(0xFFBF4413));
    canvas.drawPath(
      Path()..moveTo(21, 62)..lineTo(79, 62)..lineTo(75, 86)..quadraticBezierTo(74, 92, 67, 92)..lineTo(33, 92)..quadraticBezierTo(26, 92, 25, 86)..close(),
      fill(0xFFD9531E),
    );
    final stripe = Paint()
      ..color = const Color(0xFFEFA07C)
      ..strokeWidth = 3.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(38, 67), const Offset(36.5, 84), stripe);
    canvas.drawLine(const Offset(50, 67), const Offset(50, 84), stripe);
    canvas.drawLine(const Offset(62, 67), const Offset(63.5, 84), stripe);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
