import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../theme.dart';

/// Карта доставки. До принятия (approx) — зона-круг без точной точки;
/// после принятия — точный маркер. Тайлы — OpenStreetMap (бесплатно, не Google).
class DeliveryMap extends StatelessWidget {
  final double lat;
  final double lng;
  final bool approx;
  const DeliveryMap({super.key, required this.lat, required this.lng, required this.approx});

  @override
  Widget build(BuildContext context) {
    final center = LatLng(lat, lng);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 180,
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(
                initialCenter: center,
                initialZoom: approx ? 13 : 16,
                interactionOptions: const InteractionOptions(flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'kz.kartop.merchant',
                  maxZoom: 19,
                ),
                if (approx)
                  CircleLayer(circles: [
                    CircleMarker(
                      point: center,
                      radius: 600,
                      useRadiusInMeter: true,
                      color: AppColors.carrot.withValues(alpha: 0.15),
                      borderColor: AppColors.carrot,
                      borderStrokeWidth: 2,
                    ),
                  ])
                else
                  MarkerLayer(markers: [
                    Marker(
                      point: center,
                      width: 40,
                      height: 40,
                      child: const Icon(Icons.location_on, color: AppColors.carrot, size: 40),
                    ),
                  ]),
              ],
            ),
            if (approx)
              Positioned(
                left: 8,
                bottom: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(999)),
                  child: const Text('Примерная зона', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.carrot600)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
