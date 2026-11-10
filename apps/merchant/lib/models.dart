/// Модели данных приложения магазина. Деньги — в тиынах, вес — в граммах.
library;

class StoreSummary {
  final String id;
  final String slug;
  final String name;
  final String status;
  final String myRole;
  StoreSummary({required this.id, required this.slug, required this.name, required this.status, required this.myRole});
  factory StoreSummary.fromJson(Map<String, dynamic> j) => StoreSummary(
        id: j['id'] as String,
        slug: j['slug'] as String? ?? '',
        name: j['name'] as String? ?? '',
        status: j['status'] as String? ?? '',
        myRole: j['myRole'] as String? ?? '',
      );
}

class StoreSettings {
  bool pickupEnabled;
  int pickupLeadMinutes;
  bool deliveryEnabled;
  int courierHandoverMinutes;
  int ownDeliveryMinutes;
  String deliveryMode;
  /// Версия фото магазина (null — фото нет).
  int? photoVersion;
  /// Часы работы: 7 дней (пн первый), {'open': 'HH:MM', 'close': 'HH:MM'} или null — выходной.
  List<Map<String, String>?> hours;
  StoreSettings({
    required this.pickupEnabled,
    required this.pickupLeadMinutes,
    required this.deliveryEnabled,
    required this.courierHandoverMinutes,
    required this.ownDeliveryMinutes,
    required this.deliveryMode,
    this.photoVersion,
    this.hours = const [],
  });
  factory StoreSettings.fromJson(Map<String, dynamic> j) => StoreSettings(
        pickupEnabled: j['pickupEnabled'] as bool? ?? true,
        pickupLeadMinutes: (j['pickupLeadMinutes'] as num?)?.toInt() ?? 60,
        deliveryEnabled: j['deliveryEnabled'] as bool? ?? true,
        courierHandoverMinutes: (j['courierHandoverMinutes'] as num?)?.toInt() ?? 30,
        ownDeliveryMinutes: (j['ownDeliveryMinutes'] as num?)?.toInt() ?? 60,
        deliveryMode: j['deliveryMode'] as String? ?? 'OWN',
        photoVersion: (j['photoVersion'] as num?)?.toInt(),
        hours: ((j['hours'] as List?) ?? const [])
            .map((d) => d == null ? null : {'open': '${d['open']}', 'close': '${d['close']}'})
            .toList(),
      );
}

class OrderSummary {
  final String id;
  final int number;
  final String status;
  final DateTime createdAt;
  final int amountTiyn;
  final String payMethod;
  final String fulfillment;
  final DateTime? pickupAt;
  final int itemCount;
  OrderSummary({
    required this.id,
    required this.number,
    required this.status,
    required this.createdAt,
    required this.amountTiyn,
    required this.payMethod,
    required this.fulfillment,
    required this.pickupAt,
    required this.itemCount,
  });
  factory OrderSummary.fromJson(Map<String, dynamic> j) => OrderSummary(
        id: j['id'] as String,
        number: (j['number'] as num).toInt(),
        status: j['status'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        amountTiyn: (j['amountTiyn'] as num?)?.toInt() ?? 0,
        payMethod: j['payMethod'] as String? ?? 'CASH',
        fulfillment: j['fulfillment'] as String? ?? 'DELIVERY',
        pickupAt: j['pickupAt'] != null ? DateTime.parse(j['pickupAt'] as String) : null,
        itemCount: (j['itemCount'] as num?)?.toInt() ?? 0,
      );
}

class OrderItem {
  final String id;
  final String name;
  final String unit;
  final int? qtyRequestedG;
  final int? qtyRequested;
  final int? qtyActualG;
  final int priceSnapTiyn;
  final String status;
  OrderItem({
    required this.id,
    required this.name,
    required this.unit,
    required this.qtyRequestedG,
    required this.qtyRequested,
    required this.qtyActualG,
    required this.priceSnapTiyn,
    required this.status,
  });
  bool get weighted => unit == 'KG' || unit == 'G';
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'] as String,
        name: j['name'] as String? ?? 'Товар',
        unit: j['unit'] as String? ?? 'PCS',
        qtyRequestedG: (j['qtyRequestedG'] as num?)?.toInt(),
        qtyRequested: (j['qtyRequested'] as num?)?.toInt(),
        qtyActualG: (j['qtyActualG'] as num?)?.toInt(),
        priceSnapTiyn: (j['priceSnapTiyn'] as num?)?.toInt() ?? 0,
        status: j['status'] as String? ?? 'ok',
      );
}

class OrderDetail {
  final String id;
  final int number;
  final String status;
  final int subtotalTiyn;
  final int? finalTiyn;
  /// Платная доставка — уже входит в finalTiyn; к subtotalTiyn прибавляем.
  final int deliveryFeeTiyn;
  final String payMethod;
  final String fulfillment;
  final DateTime? pickupAt;
  final List<OrderItem> items;
  final String? customerName;
  final String? customerPhone;
  final String? addressLine;
  final String? district;
  // Точная точка (после принятия) или огрублённая зона (до принятия).
  final double? lat;
  final double? lng;
  final bool approx; // true — координаты огрублены (до принятия)
  OrderDetail({
    required this.id,
    required this.number,
    required this.status,
    required this.subtotalTiyn,
    required this.finalTiyn,
    this.deliveryFeeTiyn = 0,
    required this.payMethod,
    required this.fulfillment,
    required this.pickupAt,
    required this.items,
    required this.customerName,
    required this.customerPhone,
    required this.addressLine,
    required this.district,
    required this.lat,
    required this.lng,
    required this.approx,
  });
  bool get piiVisible => customerPhone != null;
  bool get hasLocation => lat != null && lng != null;
  factory OrderDetail.fromJson(Map<String, dynamic> j) {
    final pii = j['pii'] as Map<String, dynamic>?;
    final addr = pii?['address'] as Map<String, dynamic>?;
    final approxLoc = j['approxLocation'] as Map<String, dynamic>?;
    final exactLoc = j['location'] as Map<String, dynamic>?;
    final loc = exactLoc ?? approxLoc;
    return OrderDetail(
      id: j['id'] as String,
      number: (j['number'] as num).toInt(),
      status: j['status'] as String,
      subtotalTiyn: (j['subtotalTiyn'] as num?)?.toInt() ?? 0,
      finalTiyn: (j['finalTiyn'] as num?)?.toInt(),
      deliveryFeeTiyn: (j['deliveryFeeTiyn'] as num?)?.toInt() ?? 0,
      payMethod: j['payMethod'] as String? ?? 'CASH',
      fulfillment: j['fulfillment'] as String? ?? 'DELIVERY',
      pickupAt: j['pickupAt'] != null ? DateTime.parse(j['pickupAt'] as String) : null,
      items: ((j['items'] as List?) ?? []).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      customerName: pii?['name'] as String?,
      customerPhone: pii?['phone'] as String?,
      addressLine: addr?['line'] as String?,
      district: j['district'] as String?,
      lat: (loc?['lat'] as num?)?.toDouble(),
      lng: (loc?['lng'] as num?)?.toDouble(),
      approx: exactLoc == null,
    );
  }
}

class CatalogItem {
  final String id;
  final String name;
  final String unit;
  /// Названия по языкам из общего каталога: { ru, kk, en }.
  final Map<String, dynamic> names;
  final String categoryId;
  /// Название категории по языкам: { ru, kk, en }.
  final Map<String, dynamic> categoryNames;
  final int categorySort;
  /// Крупная группа каталога («Фрукты и ягоды»…): родитель категории. Пусто — без группы.
  final String groupId;
  final Map<String, dynamic> groupNames;
  final int groupSort;
  int priceTiyn;
  bool inStock;
  CatalogItem({
    required this.id,
    required this.name,
    required this.unit,
    required this.names,
    required this.categoryId,
    required this.categoryNames,
    required this.categorySort,
    required this.groupId,
    required this.groupNames,
    required this.groupSort,
    required this.priceTiyn,
    required this.inStock,
  });
  factory CatalogItem.fromJson(Map<String, dynamic> j) {
    final master = j['master'] as Map<String, dynamic>?;
    final name = master?['name'] as Map<String, dynamic>?;
    final category = master?['category'] as Map<String, dynamic>?;
    final group = category?['parent'] as Map<String, dynamic>?;
    return CatalogItem(
      id: j['id'] as String,
      name: name?['ru'] as String? ?? 'Товар',
      unit: master?['unit'] as String? ?? 'PCS',
      names: name ?? const {},
      categoryId: category?['id'] as String? ?? '',
      categoryNames: category?['name'] as Map<String, dynamic>? ?? const {},
      categorySort: (category?['sort'] as num?)?.toInt() ?? 0,
      groupId: group?['id'] as String? ?? '',
      groupNames: group?['name'] as Map<String, dynamic>? ?? const {},
      groupSort: (group?['sort'] as num?)?.toInt() ?? 999,
      priceTiyn: (j['priceTiyn'] as num?)?.toInt() ?? 0,
      inStock: j['inStock'] as bool? ?? true,
    );
  }
}

/// Уведомление в центре уведомлений.
class AppNotification {
  final String type;
  final String? refId;
  final String title;
  final String body;
  final bool read;
  final DateTime createdAt;
  AppNotification({required this.type, this.refId, required this.title, required this.body, required this.read, required this.createdAt});
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        type: j['type'] as String? ?? '',
        refId: j['refId'] as String?,
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        read: j['readAt'] != null,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}
