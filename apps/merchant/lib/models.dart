/// Модели данных приложения магазина. Деньги — в тиынах, вес — в граммах.
library;

class StoreSummary {
  final String id;
  final String slug;
  final String name;
  final String status;
  final String myRole;
  /// Магазин подключился по заявке из приложения (а не заведён платформой).
  final bool selfRegistered;
  StoreSummary({required this.id, required this.slug, required this.name, required this.status, required this.myRole, this.selfRegistered = false});
  factory StoreSummary.fromJson(Map<String, dynamic> j) => StoreSummary(
        id: j['id'] as String,
        slug: j['slug'] as String? ?? '',
        name: j['name'] as String? ?? '',
        status: j['status'] as String? ?? '',
        myRole: j['myRole'] as String? ?? '',
        selfRegistered: j['selfRegistered'] == true,
      );

  /// Заявка ещё не одобрена: вместо договора по SMS — экран заявки.
  bool get isApplication => selfRegistered && status == 'PENDING';
}

/// Заявка магазина: данные, фото, договор, проверки и состояние (DRAFT | SUBMITTED | REJECTED | APPROVED).
class StoreApplication {
  final String id;
  final String name;
  final String slug;
  final String status;
  final String? address;
  final String? legalName;
  final String? legalBin;
  final String? rejectReason;
  final String state;
  final int productCount;
  final Map<String, bool> checks;
  final bool ready;
  final List<({String id, String kind})> documents;
  StoreApplication({
    required this.id, required this.name, required this.slug, required this.status, this.address, this.legalName, this.legalBin,
    this.rejectReason, required this.state, required this.productCount, required this.checks, required this.ready, required this.documents,
  });
  factory StoreApplication.fromJson(Map<String, dynamic> j) => StoreApplication(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        slug: j['slug'] as String? ?? '',
        status: j['status'] as String? ?? '',
        address: j['address'] as String?,
        legalName: j['legalName'] as String?,
        legalBin: j['legalBin'] as String?,
        rejectReason: j['applicationRejectReason'] as String?,
        state: j['state'] as String? ?? 'DRAFT',
        productCount: (j['productCount'] as num?)?.toInt() ?? 0,
        checks: ((j['checks'] as Map?) ?? {}).map((k, v) => MapEntry(k as String, v == true)),
        ready: j['ready'] == true,
        documents: ((j['documents'] as List?) ?? [])
            .map((e) => (id: (e as Map)['id'] as String, kind: e['kind'] as String))
            .toList(),
      );
  bool get editable => state == 'DRAFT' || state == 'REJECTED';
  List<String> docs(String kind) => [for (final d in documents) if (d.kind == kind) d.id];
}

/// Тариф для магазинов (страница kar-top.kz/tariffs).
class Tariff {
  final String id;
  final String title;
  final DateTime effectiveFrom;
  Tariff({required this.id, required this.title, required this.effectiveFrom});
  factory Tariff.fromJson(Map<String, dynamic> j) => Tariff(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        effectiveFrom: DateTime.parse(j['effectiveFrom'] as String).toLocal(),
      );
}

class StoreSettings {
  bool pickupEnabled;
  int pickupLeadMinutes;
  bool deliveryEnabled;
  int courierHandoverMinutes;
  int ownDeliveryMinutes;
  /// Предзаказ: заказы до preorderCutoff ('ЧЧ:ММ') — на следующий рабочий день.
  bool preorderEnabled;
  String preorderCutoff;
  /// Своя доставка: минимальный заказ и «бесплатно от» (тиыны; null — бесплатной нет).
  int ownMinOrderTiyn;
  int? ownFreeFromTiyn;
  /// Видимость: listed — магазин показан всем; listingRequested — заявка «показывать всем» ждёт решения.
  bool listed;
  bool listingRequested;
  /// До какого числа показан всем (null — не показан), бесплатный ли сейчас период, истёк ли, цена подписки (тиыны/мес).
  DateTime? listedUntil;
  bool listingFree;
  bool listingExpired;
  int? listingPriceTiyn;
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
    this.preorderEnabled = false,
    this.preorderCutoff = '20:00',
    this.ownMinOrderTiyn = 0,
    this.ownFreeFromTiyn,
    this.listed = false,
    this.listingRequested = false,
    this.listedUntil,
    this.listingFree = false,
    this.listingExpired = false,
    this.listingPriceTiyn,
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
        preorderEnabled: j['preorderEnabled'] as bool? ?? false,
        preorderCutoff: j['preorderCutoff'] as String? ?? '20:00',
        ownMinOrderTiyn: (j['ownMinOrderTiyn'] as num?)?.toInt() ?? 0,
        ownFreeFromTiyn: (j['ownFreeFromTiyn'] as num?)?.toInt(),
        listed: j['listed'] as bool? ?? false,
        listingRequested: j['listingRequested'] as bool? ?? false,
        listedUntil: j['listedUntil'] == null ? null : DateTime.tryParse(j['listedUntil'] as String)?.toLocal(),
        listingFree: j['listingFree'] as bool? ?? false,
        listingExpired: j['listingExpired'] as bool? ?? false,
        listingPriceTiyn: (j['listingPriceTiyn'] as num?)?.toInt(),
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
  /// Кто везёт: OWN — магазин, SERVICE — курьерская служба (доставку оплачивает клиент). null — самовывоз.
  final String? deliveryBy;
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
    this.deliveryBy,
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
      deliveryBy: j['deliveryBy'] as String?,
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
  /// Названия по языкам из общего каталога: { ru, kk, en } (+ tg, uz у категорий).
  final Map<String, dynamic> names;
  final String categoryId;
  /// Название категории по языкам: { ru, kk, en, tg, uz }.
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

/// Сотрудник магазина (экран «Сотрудники»).
class StoreMemberInfo {
  final String userId;
  final String phone;
  final String? name;
  final String role;
  final bool active;
  final bool you;
  StoreMemberInfo({required this.userId, required this.phone, this.name, required this.role, required this.active, required this.you});
  factory StoreMemberInfo.fromJson(Map<String, dynamic> j) => StoreMemberInfo(
        userId: j['userId'] as String,
        phone: j['phone'] as String? ?? '',
        name: j['name'] as String?,
        role: j['role'] as String? ?? '',
        active: j['active'] == true,
        you: j['you'] == true,
      );
}
