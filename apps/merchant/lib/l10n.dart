import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Язык интерфейса приложения магазина: ru, kk, tg, uz.
/// Выбор сохраняется на устройстве; по умолчанию — язык телефона, если он поддержан, иначе русский.
class Lang extends ChangeNotifier {
  static const supported = ['ru', 'kk', 'tg', 'uz'];
  static const _kLang = 'lang';

  String code = 'ru';
  S get s => S.forCode(code);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kLang);
    final device = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    code = supported.contains(saved) ? saved! : (supported.contains(device) ? device : 'ru');
  }

  Future<void> set(String c) async {
    if (!supported.contains(c) || c == code) return;
    code = c;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLang, c);
  }
}

/// Строки интерфейса. Каждый язык реализует все члены — компилятор не даст пропустить перевод.
abstract class S {
  const S();

  /// Строки текущего языка; виджет перестраивается при смене языка.
  static S of(BuildContext context) => context.watch<Lang>().s;

  static S forCode(String code) => switch (code) {
        'kk' => const _Kk(),
        'tg' => const _Tg(),
        'uz' => const _Uz(),
        _ => const _Ru(),
      };

  /// Самоназвания языков — для переключателя.
  static const names = {'ru': 'Русский', 'kk': 'Қазақша', 'tg': 'Тоҷикӣ', 'uz': 'Oʻzbekcha'};

  /// Код языка: ru, kk, tg, uz.
  String get code;

  /// Локаль для дат (intl). У таджикского нет своих данных — даты по-русски.
  String get dateLocale;

  String get appTitle;
  String get testBanner;
  String get biometricReason;

  // Единицы и справочники
  String get unitKg;
  String get unitG;
  String get unitPcs;
  String get unitBunch;
  String get unitPack;
  String get payCash;
  String get payCardCourier;
  String get payKaspi;
  Map<String, String> get statuses;
  Map<String, String> get roles;
  Map<String, String> get storeStatuses;
  String get total;
  String get estimateNote;
  String get weigh;
  String get customer;
  String ordered(String qty);
  String get weighed;
  String get changeWeight;
  String get weightGrams;
  String sumPreview(String amount);
  String perKgPrice(String price);
  String get buildRoute;

  // Вход
  String get merchantCabinet;
  String get phone;
  String get sending;
  String get getCode;
  String codeSentTo(String phone);
  String get checking;
  String get signIn;
  String get changeNumber;
  String get notPartnerYet;
  String get becomePartner;

  // Магазины и навигация
  String get myStores;
  String get notLinkedToStore;
  String get store;
  String get switchStore;
  String get tabOrders;
  String get tabProducts;
  String get tabSettings;

  // Замок
  String get enterPin;
  String get wrongPin;
  String get forgotPin;

  // Заказы
  String get noOrders;
  String get activeOrders;
  String get completedOrders;
  String orderNo(int n);
  String positions(int n);
  String get order;
  String get error;
  String weighTitle(String name);
  String get actualWeight;
  String get cancel;
  String get save;
  String get pickup;
  String get delivery;
  String district(String d);
  String get piiHidden;
  String get callCustomer;
  String get copyPhone;
  String get phoneCopied;
  String get whatsapp;
  String get cannotOpen;
  String pickupAt(String time);
  String get orderItems;
  String get needsWeighing;
  String get outOfStock;
  String get payOnReceipt;
  String get acceptOrder;
  String get startPicking;
  String get pickedReady;
  String get readyForPickup;
  String get handToDelivery;
  String get confirmByCode;
  String get approxZone;

  // Выдача по коду
  String handoverNo(int n);
  String get askCode;
  String get askCodeHint;
  String get wrongCode;
  String get takePayment;
  String get orderHandedOver;
  String handedOverText(String amount);
  String get done;

  // Товары
  String get pricePerKg;
  String get pricePerPcs;
  String get proposeItem;
  String get catalogEmpty;

  // Настройки
  String get setPin;
  String get enable;
  String get pickupReadiness;
  String get pickupReadinessHelper;
  String get minutes;
  String get deliveryAndPickup;
  String get pickupSubtitle;
  String pickupLeadValue(int n);
  String get security;
  String get appLock;
  String get appLockSubtitle;
  String get logout;
  String get language;

  // Заявка партнёра
  String get applicationAccepted;
  String get partnerSuccessText;
  String get backToLogin;
  String get partnerTitle;
  String get partnerIntro;
  String get yourName;
  String get yourNameHint;
  String get companyName;
  String get companyHint;
  String get twogisLink;
  String get sendApplication;
  String get consent;
  String get optionalSuffix;

  // Заявка в каталог
  String get catalogRequestTitle;
  String get requestSent;
  String get requestSentText;
  String get proposeTitle;
  String get product;
  String get category;
  String get productName;
  String get categoryName;
  String get productHint;
  String get categoryHint;
  String get unit;
  String get categoryIfKnown;
  String get categoryOptHint;
  String get comment;
  String get optional;
  String get enterName;
}

class _Ru extends S {
  const _Ru();
  @override String get code => 'ru';
  @override String get dateLocale => 'ru';
  @override String get appTitle => 'Kartop — магазин';
  @override String get testBanner => 'ТЕСТ';
  @override String get biometricReason => 'Подтвердите вход в Kartop';
  @override String get unitKg => 'кг';
  @override String get unitG => 'г';
  @override String get unitPcs => 'шт';
  @override String get unitBunch => 'пучок';
  @override String get unitPack => 'упак.';
  @override String get payCash => 'Наличными';
  @override String get payCardCourier => 'Картой курьеру';
  @override String get payKaspi => 'Перевод Kaspi';
  @override Map<String, String> get statuses => const {
        'PLACED': 'Новый',
        'ACCEPTED': 'Принят',
        'PICKING': 'Сборка',
        'AWAITING_CUSTOMER': 'Ждём клиента',
        'READY': 'Готов',
        'COURIER_ASSIGNED': 'Курьер назначен',
        'DELIVERING': 'В пути',
        'DELIVERED': 'Доставлен',
        'COMPLETED': 'Завершён',
        'CANCELLED': 'Отменён',
      };
  @override Map<String, String> get roles => const {'OWNER': 'Владелец', 'MANAGER': 'Менеджер', 'PICKER': 'Сборщик', 'COURIER': 'Курьер'};
  @override Map<String, String> get storeStatuses => const {'PENDING': 'На модерации', 'SUSPENDED': 'Приостановлен', 'BLOCKED': 'Заблокирован'};
  @override String get total => 'Итого';
  @override String get estimateNote => 'Оценочно — точная сумма после взвешивания';
  @override String get weigh => 'Взвесить';
  @override String get customer => 'Клиент';
  @override String ordered(String qty) => 'Заказано: $qty';
  @override String get weighed => 'Взвешено';
  @override String get changeWeight => 'Изменить вес';
  @override String get weightGrams => 'Вес, г';
  @override String sumPreview(String amount) => 'Сумма: $amount';
  @override String perKgPrice(String price) => '$price за кг';
  @override String get buildRoute => 'Построить маршрут';
  @override String get merchantCabinet => 'Кабинет магазина';
  @override String get phone => 'Телефон';
  @override String get sending => 'Отправляем…';
  @override String get getCode => 'Получить код';
  @override String codeSentTo(String phone) => 'Код отправлен на $phone';
  @override String get checking => 'Проверяем…';
  @override String get signIn => 'Войти';
  @override String get changeNumber => 'Изменить номер';
  @override String get notPartnerYet => 'Ещё не партнёр Kartop?';
  @override String get becomePartner => 'Стать партнёром';
  @override String get myStores => 'Мои магазины';
  @override String get notLinkedToStore => 'Вы пока не привязаны к магазину';
  @override String get store => 'Магазин';
  @override String get switchStore => 'Сменить магазин';
  @override String get tabOrders => 'Заказы';
  @override String get tabProducts => 'Товары';
  @override String get tabSettings => 'Настройки';
  @override String get enterPin => 'Введите PIN для входа';
  @override String get wrongPin => 'Неверный PIN';
  @override String get forgotPin => 'Забыли PIN? Войти заново';
  @override String get noOrders => 'Заказов пока нет';
  @override String get activeOrders => 'Активные';
  @override String get completedOrders => 'Завершённые';
  @override String orderNo(int n) => 'Заказ №$n';
  @override String positions(int n) => '$n поз.';
  @override String get order => 'Заказ';
  @override String get error => 'Ошибка';
  @override String weighTitle(String name) => 'Взвесить: $name';
  @override String get actualWeight => 'Фактический вес';
  @override String get cancel => 'Отмена';
  @override String get save => 'Сохранить';
  @override String get pickup => 'Самовывоз';
  @override String get delivery => 'Доставка';
  @override String district(String d) => 'Район: $d';
  @override String get piiHidden => 'Имя, телефон и точный адрес откроются после принятия заказа';
  @override String get callCustomer => 'Позвонить';
  @override String get copyPhone => 'Копировать';
  @override String get phoneCopied => 'Номер скопирован';
  @override String get whatsapp => 'WhatsApp';
  @override String get cannotOpen => 'Не удалось открыть приложение';
  @override String pickupAt(String time) => 'Самовывоз: $time';
  @override String get orderItems => 'Состав заказа';
  @override String get needsWeighing => 'нужно взвесить';
  @override String get outOfStock => 'Нет в наличии';
  @override String get payOnReceipt => 'Оплата при получении';
  @override String get acceptOrder => 'Принять заказ';
  @override String get startPicking => 'Начать сборку';
  @override String get pickedReady => 'Собрано, готово';
  @override String get readyForPickup => 'К выдаче';
  @override String get handToDelivery => 'Передать в доставку';
  @override String get confirmByCode => 'Подтвердить выдачу по коду';
  @override String get approxZone => 'Примерная зона';
  @override String handoverNo(int n) => 'Выдача №$n';
  @override String get askCode => 'Попросите у клиента код';
  @override String get askCodeHint => '4-значный код — в приложении покупателя. Так подтверждается, что заказ у него на руках.';
  @override String get wrongCode => 'Неверный код, попробуйте ещё раз';
  @override String get takePayment => 'Принять оплату';
  @override String get orderHandedOver => 'Заказ выдан';
  @override String handedOverText(String amount) => 'Код подтверждён. Оплата $amount принята. Заказ закрыт.';
  @override String get done => 'Готово';
  @override String get pricePerKg => 'Цена за кг';
  @override String get pricePerPcs => 'Цена за шт';
  @override String get proposeItem => 'Предложить товар или категорию';
  @override String get catalogEmpty => 'Ассортимент пуст';
  @override String get setPin => 'Задайте PIN (4 цифры)';
  @override String get enable => 'Включить';
  @override String get pickupReadiness => 'Готовность к самовывозу';
  @override String get pickupReadinessHelper => 'Через сколько минут после заказа можно забрать';
  @override String get minutes => 'мин';
  @override String get deliveryAndPickup => 'Доставка и самовывоз';
  @override String get pickupSubtitle => 'Клиент забирает заказ сам';
  @override String pickupLeadValue(int n) => '$n мин после оформления';
  @override String get security => 'Безопасность';
  @override String get appLock => 'Защита входа';
  @override String get appLockSubtitle => 'Face ID / отпечаток или PIN при открытии';
  @override String get logout => 'Выйти из аккаунта';
  @override String get language => 'Язык';
  @override String get applicationAccepted => 'Заявка принята!';
  @override String get partnerSuccessText => 'Мы свяжемся с вами по телефону, чтобы подключить магазин к Kartop. Обычно в течение рабочего дня.';
  @override String get backToLogin => 'Назад ко входу';
  @override String get partnerTitle => 'Выведите магазин в онлайн';
  @override String get partnerIntro => 'Оставьте контакты — поможем подключить ваш магазин к Kartop. Подключение по приглашению.';
  @override String get yourName => 'Ваше имя';
  @override String get yourNameHint => 'Как к вам обращаться';
  @override String get companyName => 'Название компании';
  @override String get companyHint => 'Напр. «Фрукты у Руслана»';
  @override String get twogisLink => 'Ссылка на 2ГИС';
  @override String get sendApplication => 'Отправить заявку';
  @override String get consent => 'Нажимая кнопку, вы соглашаетесь на обработку контактных данных для связи.';
  @override String get optionalSuffix => ' — необязательно';
  @override String get catalogRequestTitle => 'Заявка в каталог';
  @override String get requestSent => 'Заявка отправлена!';
  @override String get requestSentText => 'Платформа рассмотрит её. После одобрения позиция появится в каталоге, и вы сможете добавить её в свой ассортимент.';
  @override String get proposeTitle => 'Предложите позицию для общего каталога';
  @override String get product => 'Товар';
  @override String get category => 'Категория';
  @override String get productName => 'Название товара';
  @override String get categoryName => 'Название категории';
  @override String get productHint => 'Напр. «Яблоко Фуджи»';
  @override String get categoryHint => 'Напр. «Орехи»';
  @override String get unit => 'Единица измерения';
  @override String get categoryIfKnown => 'Категория (если знаете)';
  @override String get categoryOptHint => 'Напр. «Яблоки» — необязательно';
  @override String get comment => 'Комментарий';
  @override String get optional => 'Необязательно';
  @override String get enterName => 'Укажите название';
}

class _Kk extends S {
  const _Kk();
  @override String get code => 'kk';
  @override String get dateLocale => 'kk';
  @override String get appTitle => 'Kartop — дүкен';
  @override String get testBanner => 'ТЕСТ';
  @override String get biometricReason => 'Kartop-қа кіруді растаңыз';
  @override String get unitKg => 'кг';
  @override String get unitG => 'г';
  @override String get unitPcs => 'дана';
  @override String get unitBunch => 'байлам';
  @override String get unitPack => 'қаптама';
  @override String get payCash => 'Қолма-қол';
  @override String get payCardCourier => 'Курьерге картамен';
  @override String get payKaspi => 'Kaspi аударымы';
  @override Map<String, String> get statuses => const {
        'PLACED': 'Жаңа',
        'ACCEPTED': 'Қабылданды',
        'PICKING': 'Жиналуда',
        'AWAITING_CUSTOMER': 'Клиентті күтеміз',
        'READY': 'Дайын',
        'COURIER_ASSIGNED': 'Курьер тағайындалды',
        'DELIVERING': 'Жолда',
        'DELIVERED': 'Жеткізілді',
        'COMPLETED': 'Аяқталды',
        'CANCELLED': 'Бас тартылды',
      };
  @override Map<String, String> get roles => const {'OWNER': 'Иесі', 'MANAGER': 'Менеджер', 'PICKER': 'Жинаушы', 'COURIER': 'Курьер'};
  @override Map<String, String> get storeStatuses => const {'PENDING': 'Модерацияда', 'SUSPENDED': 'Тоқтатылған', 'BLOCKED': 'Бұғатталған'};
  @override String get total => 'Барлығы';
  @override String get estimateNote => 'Шамамен — нақты сома өлшегеннен кейін';
  @override String get weigh => 'Өлшеу';
  @override String get customer => 'Клиент';
  @override String ordered(String qty) => 'Тапсырыс: $qty';
  @override String get weighed => 'Өлшенді';
  @override String get changeWeight => 'Салмағын өзгерту';
  @override String get weightGrams => 'Салмағы, г';
  @override String sumPreview(String amount) => 'Сомасы: $amount';
  @override String perKgPrice(String price) => '1 кг — $price';
  @override String get buildRoute => 'Маршрут құру';
  @override String get merchantCabinet => 'Дүкен кабинеті';
  @override String get phone => 'Телефон';
  @override String get sending => 'Жіберілуде…';
  @override String get getCode => 'Код алу';
  @override String codeSentTo(String phone) => 'Код $phone нөміріне жіберілді';
  @override String get checking => 'Тексерілуде…';
  @override String get signIn => 'Кіру';
  @override String get changeNumber => 'Нөмірді өзгерту';
  @override String get notPartnerYet => 'Әлі Kartop серіктесі емессіз бе?';
  @override String get becomePartner => 'Серіктес болу';
  @override String get myStores => 'Менің дүкендерім';
  @override String get notLinkedToStore => 'Сіз әлі ешбір дүкенге тіркелмегенсіз';
  @override String get store => 'Дүкен';
  @override String get switchStore => 'Дүкенді ауыстыру';
  @override String get tabOrders => 'Тапсырыстар';
  @override String get tabProducts => 'Тауарлар';
  @override String get tabSettings => 'Баптаулар';
  @override String get enterPin => 'Кіру үшін PIN енгізіңіз';
  @override String get wrongPin => 'PIN қате';
  @override String get forgotPin => 'PIN ұмыттыңыз ба? Қайта кіру';
  @override String get noOrders => 'Әзірге тапсырыс жоқ';
  @override String get activeOrders => 'Белсенді';
  @override String get completedOrders => 'Аяқталған';
  @override String orderNo(int n) => 'Тапсырыс №$n';
  @override String positions(int n) => '$n тауар';
  @override String get order => 'Тапсырыс';
  @override String get error => 'Қате';
  @override String weighTitle(String name) => 'Өлшеу: $name';
  @override String get actualWeight => 'Нақты салмағы';
  @override String get cancel => 'Болдырмау';
  @override String get save => 'Сақтау';
  @override String get pickup => 'Өзі алып кету';
  @override String get delivery => 'Жеткізу';
  @override String district(String d) => 'Аудан: $d';
  @override String get piiHidden => 'Аты, телефоны және нақты мекенжайы тапсырыс қабылданғаннан кейін ашылады';
  @override String get callCustomer => 'Қоңырау шалу';
  @override String get copyPhone => 'Көшіру';
  @override String get phoneCopied => 'Нөмір көшірілді';
  @override String get whatsapp => 'WhatsApp';
  @override String get cannotOpen => 'Қосымшаны ашу мүмкін болмады';
  @override String pickupAt(String time) => 'Алып кету: $time';
  @override String get orderItems => 'Тапсырыс құрамы';
  @override String get needsWeighing => 'өлшеу керек';
  @override String get outOfStock => 'Қолда жоқ';
  @override String get payOnReceipt => 'Алған кезде төлеу';
  @override String get acceptOrder => 'Тапсырысты қабылдау';
  @override String get startPicking => 'Жинауды бастау';
  @override String get pickedReady => 'Жиналды, дайын';
  @override String get readyForPickup => 'Беруге дайын';
  @override String get handToDelivery => 'Жеткізуге беру';
  @override String get confirmByCode => 'Кодпен беруді растау';
  @override String get approxZone => 'Шамамен аймақ';
  @override String handoverNo(int n) => 'Беру №$n';
  @override String get askCode => 'Клиенттен кодты сұраңыз';
  @override String get askCodeHint => '4 таңбалы код сатып алушының қосымшасында. Осылайша тапсырыстың оның қолына тигені расталады.';
  @override String get wrongCode => 'Код қате, қайталап көріңіз';
  @override String get takePayment => 'Төлемді қабылдау';
  @override String get orderHandedOver => 'Тапсырыс берілді';
  @override String handedOverText(String amount) => 'Код расталды. $amount төлем қабылданды. Тапсырыс жабылды.';
  @override String get done => 'Дайын';
  @override String get pricePerKg => '1 кг бағасы';
  @override String get pricePerPcs => '1 дана бағасы';
  @override String get proposeItem => 'Тауар немесе санат ұсыну';
  @override String get catalogEmpty => 'Ассортимент бос';
  @override String get setPin => 'PIN орнатыңыз (4 сан)';
  @override String get enable => 'Қосу';
  @override String get pickupReadiness => 'Алып кетуге дайындық';
  @override String get pickupReadinessHelper => 'Тапсырыстан кейін неше минутта алып кетуге болады';
  @override String get minutes => 'мин';
  @override String get deliveryAndPickup => 'Жеткізу және алып кету';
  @override String get pickupSubtitle => 'Клиент тапсырысты өзі алып кетеді';
  @override String pickupLeadValue(int n) => 'Рәсімдегеннен кейін $n мин';
  @override String get security => 'Қауіпсіздік';
  @override String get appLock => 'Кіруді қорғау';
  @override String get appLockSubtitle => 'Ашқанда Face ID / саусақ ізі немесе PIN';
  @override String get logout => 'Аккаунттан шығу';
  @override String get language => 'Тіл';
  @override String get applicationAccepted => 'Өтінім қабылданды!';
  @override String get partnerSuccessText => 'Дүкеніңізді Kartop-қа қосу үшін сізге телефон арқылы хабарласамыз. Әдетте бір жұмыс күні ішінде.';
  @override String get backToLogin => 'Кіруге оралу';
  @override String get partnerTitle => 'Дүкеніңізді онлайнға шығарыңыз';
  @override String get partnerIntro => 'Байланыс деректеріңізді қалдырыңыз — дүкеніңізді Kartop-қа қосуға көмектесеміз. Қосылу шақыру бойынша.';
  @override String get yourName => 'Атыңыз';
  @override String get yourNameHint => 'Сізге қалай жүгінейік';
  @override String get companyName => 'Компания атауы';
  @override String get companyHint => 'Мысалы, «Русланның жемістері»';
  @override String get twogisLink => '2ГИС сілтемесі';
  @override String get sendApplication => 'Өтінім жіберу';
  @override String get consent => 'Батырманы басу арқылы байланыс үшін деректерді өңдеуге келісім бересіз.';
  @override String get optionalSuffix => ' — міндетті емес';
  @override String get catalogRequestTitle => 'Каталогқа өтінім';
  @override String get requestSent => 'Өтінім жіберілді!';
  @override String get requestSentText => 'Платформа оны қарап шығады. Мақұлданғаннан кейін позиция каталогта пайда болады және оны өз ассортиментіңізге қоса аласыз.';
  @override String get proposeTitle => 'Ортақ каталогқа позиция ұсыныңыз';
  @override String get product => 'Тауар';
  @override String get category => 'Санат';
  @override String get productName => 'Тауар атауы';
  @override String get categoryName => 'Санат атауы';
  @override String get productHint => 'Мысалы, «Фуджи алмасы»';
  @override String get categoryHint => 'Мысалы, «Жаңғақтар»';
  @override String get unit => 'Өлшем бірлігі';
  @override String get categoryIfKnown => 'Санат (білсеңіз)';
  @override String get categoryOptHint => 'Мысалы, «Алма» — міндетті емес';
  @override String get comment => 'Түсініктеме';
  @override String get optional => 'Міндетті емес';
  @override String get enterName => 'Атауын көрсетіңіз';
}

class _Tg extends S {
  const _Tg();
  @override String get code => 'tg';
  @override String get dateLocale => 'ru';
  @override String get appTitle => 'Kartop — мағоза';
  @override String get testBanner => 'ТЕСТ';
  @override String get biometricReason => 'Вуруд ба Kartop-ро тасдиқ кунед';
  @override String get unitKg => 'кг';
  @override String get unitG => 'г';
  @override String get unitPcs => 'дона';
  @override String get unitBunch => 'даста';
  @override String get unitPack => 'баста';
  @override String get payCash => 'Нақд';
  @override String get payCardCourier => 'Бо корт ба курьер';
  @override String get payKaspi => 'Интиқоли Kaspi';
  @override Map<String, String> get statuses => const {
        'PLACED': 'Нав',
        'ACCEPTED': 'Қабул шуд',
        'PICKING': 'Ҷамъоварӣ',
        'AWAITING_CUSTOMER': 'Интизори мизоҷ',
        'READY': 'Тайёр',
        'COURIER_ASSIGNED': 'Курьер таъин шуд',
        'DELIVERING': 'Дар роҳ',
        'DELIVERED': 'Расонида шуд',
        'COMPLETED': 'Анҷом ёфт',
        'CANCELLED': 'Бекор шуд',
      };
  @override Map<String, String> get roles => const {'OWNER': 'Соҳиб', 'MANAGER': 'Менеҷер', 'PICKER': 'Ҷамъкунанда', 'COURIER': 'Курьер'};
  @override Map<String, String> get storeStatuses => const {'PENDING': 'Дар баррасӣ', 'SUSPENDED': 'Боздошта шудааст', 'BLOCKED': 'Басташуда'};
  @override String get total => 'Ҳамагӣ';
  @override String get estimateNote => 'Тахминан — маблағи дақиқ пас аз баркашӣ';
  @override String get weigh => 'Баркашидан';
  @override String get customer => 'Мизоҷ';
  @override String ordered(String qty) => 'Фармоиш шуд: $qty';
  @override String get weighed => 'Баркашида шуд';
  @override String get changeWeight => 'Иваз кардани вазн';
  @override String get weightGrams => 'Вазн, г';
  @override String sumPreview(String amount) => 'Маблағ: $amount';
  @override String perKgPrice(String price) => '$price барои 1 кг';
  @override String get buildRoute => 'Сохтани масир';
  @override String get merchantCabinet => 'Кабинети мағоза';
  @override String get phone => 'Телефон';
  @override String get sending => 'Фиристода истодаем…';
  @override String get getCode => 'Гирифтани код';
  @override String codeSentTo(String phone) => 'Код ба $phone фиристода шуд';
  @override String get checking => 'Санҷида истодаем…';
  @override String get signIn => 'Ворид шудан';
  @override String get changeNumber => 'Иваз кардани рақам';
  @override String get notPartnerYet => 'Ҳанӯз шарики Kartop нестед?';
  @override String get becomePartner => 'Шарик шудан';
  @override String get myStores => 'Мағозаҳои ман';
  @override String get notLinkedToStore => 'Шумо ҳанӯз ба ягон мағоза пайваст нестед';
  @override String get store => 'Мағоза';
  @override String get switchStore => 'Иваз кардани мағоза';
  @override String get tabOrders => 'Фармоишҳо';
  @override String get tabProducts => 'Молҳо';
  @override String get tabSettings => 'Танзимот';
  @override String get enterPin => 'Барои ворид шудан PIN-ро ворид кунед';
  @override String get wrongPin => 'PIN нодуруст аст';
  @override String get forgotPin => 'PIN-ро фаромӯш кардед? Аз нав ворид шавед';
  @override String get noOrders => 'Ҳоло фармоиш нест';
  @override String get activeOrders => 'Фаъол';
  @override String get completedOrders => 'Анҷомёфта';
  @override String orderNo(int n) => 'Фармоиши №$n';
  @override String positions(int n) => '$n мол';
  @override String get order => 'Фармоиш';
  @override String get error => 'Хато';
  @override String weighTitle(String name) => 'Баркашидан: $name';
  @override String get actualWeight => 'Вазни воқеӣ';
  @override String get cancel => 'Бекор кардан';
  @override String get save => 'Нигоҳ доштан';
  @override String get pickup => 'Худ бурдан';
  @override String get delivery => 'Расонидан';
  @override String district(String d) => 'Ноҳия: $d';
  @override String get piiHidden => 'Ном, телефон ва суроғаи дақиқ пас аз қабули фармоиш намоён мешаванд';
  @override String get callCustomer => 'Занг задан';
  @override String get copyPhone => 'Нусха бардоштан';
  @override String get phoneCopied => 'Рақам нусхабардорӣ шуд';
  @override String get whatsapp => 'WhatsApp';
  @override String get cannotOpen => 'Барномаро кушодан нашуд';
  @override String pickupAt(String time) => 'Худ бурдан: $time';
  @override String get orderItems => 'Таркиби фармоиш';
  @override String get needsWeighing => 'бояд баркашид';
  @override String get outOfStock => 'Дар мавҷудият нест';
  @override String get payOnReceipt => 'Пардохт ҳангоми гирифтан';
  @override String get acceptOrder => 'Қабул кардани фармоиш';
  @override String get startPicking => 'Оғози ҷамъоварӣ';
  @override String get pickedReady => 'Ҷамъ шуд, тайёр';
  @override String get readyForPickup => 'Барои супоридан тайёр';
  @override String get handToDelivery => 'Ба расонидан супоридан';
  @override String get confirmByCode => 'Тасдиқи супоридан бо код';
  @override String get approxZone => 'Минтақаи тахминӣ';
  @override String handoverNo(int n) => 'Супоридани №$n';
  @override String get askCode => 'Аз мизоҷ кодро пурсед';
  @override String get askCodeHint => 'Коди 4-рақама дар барномаи харидор аст. Ҳамин тавр тасдиқ мешавад, ки фармоиш ба дасти ӯ расид.';
  @override String get wrongCode => 'Код нодуруст аст, бори дигар кӯшиш кунед';
  @override String get takePayment => 'Қабули пардохт';
  @override String get orderHandedOver => 'Фармоиш супорида шуд';
  @override String handedOverText(String amount) => 'Код тасдиқ шуд. Пардохти $amount қабул шуд. Фармоиш баста шуд.';
  @override String get done => 'Тайёр';
  @override String get pricePerKg => 'Нарх барои 1 кг';
  @override String get pricePerPcs => 'Нарх барои 1 дона';
  @override String get proposeItem => 'Пешниҳоди мол ё категория';
  @override String get catalogEmpty => 'Ассортимент холӣ аст';
  @override String get setPin => 'PIN гузоред (4 рақам)';
  @override String get enable => 'Фаъол кардан';
  @override String get pickupReadiness => 'Тайёрӣ барои худ бурдан';
  @override String get pickupReadinessHelper => 'Пас аз чанд дақиқаи фармоиш метавон бурд';
  @override String get minutes => 'дақ';
  @override String get deliveryAndPickup => 'Расонидан ва худ бурдан';
  @override String get pickupSubtitle => 'Мизоҷ фармоишро худаш мебарад';
  @override String pickupLeadValue(int n) => '$n дақ пас аз фармоиш';
  @override String get security => 'Амният';
  @override String get appLock => 'Ҳифзи вуруд';
  @override String get appLockSubtitle => 'Face ID / изи ангушт ё PIN ҳангоми кушодан';
  @override String get logout => 'Баромадан аз аккаунт';
  @override String get language => 'Забон';
  @override String get applicationAccepted => 'Дархост қабул шуд!';
  @override String get partnerSuccessText => 'Мо бо шумо тавассути телефон тамос мегирем, то мағозаатонро ба Kartop пайваст кунем. Одатан дар давоми як рӯзи корӣ.';
  @override String get backToLogin => 'Бозгашт ба вуруд';
  @override String get partnerTitle => 'Мағозаи худро онлайн кунед';
  @override String get partnerIntro => 'Маълумоти тамоси худро гузоред — барои пайваст кардани мағозаатон ба Kartop кӯмак мекунем. Пайвастшавӣ бо даъват.';
  @override String get yourName => 'Номи шумо';
  @override String get yourNameHint => 'Ба шумо чӣ тавр муроҷиат кунем';
  @override String get companyName => 'Номи ширкат';
  @override String get companyHint => 'Масалан, «Меваҳои Руслан»';
  @override String get twogisLink => 'Истинод ба 2ГИС';
  @override String get sendApplication => 'Фиристодани дархост';
  @override String get consent => 'Бо пахш кардани тугма шумо ба коркарди маълумоти тамос барои алоқа розӣ мешавед.';
  @override String get optionalSuffix => ' — ҳатмӣ нест';
  @override String get catalogRequestTitle => 'Дархост ба каталог';
  @override String get requestSent => 'Дархост фиристода шуд!';
  @override String get requestSentText => 'Платформа онро баррасӣ мекунад. Пас аз тасдиқ мавқеъ дар каталог пайдо мешавад ва шумо метавонед онро ба ассортименти худ илова кунед.';
  @override String get proposeTitle => 'Барои каталоги умумӣ мавқеъ пешниҳод кунед';
  @override String get product => 'Мол';
  @override String get category => 'Категория';
  @override String get productName => 'Номи мол';
  @override String get categoryName => 'Номи категория';
  @override String get productHint => 'Масалан, «Себи Фуҷи»';
  @override String get categoryHint => 'Масалан, «Чормағз»';
  @override String get unit => 'Воҳиди ченак';
  @override String get categoryIfKnown => 'Категория (агар донед)';
  @override String get categoryOptHint => 'Масалан, «Себ» — ҳатмӣ нест';
  @override String get comment => 'Шарҳ';
  @override String get optional => 'Ҳатмӣ нест';
  @override String get enterName => 'Номро нишон диҳед';
}

class _Uz extends S {
  const _Uz();
  @override String get code => 'uz';
  @override String get dateLocale => 'uz';
  @override String get appTitle => 'Kartop — doʻkon';
  @override String get testBanner => 'TEST';
  @override String get biometricReason => 'Kartop’ga kirishni tasdiqlang';
  @override String get unitKg => 'kg';
  @override String get unitG => 'g';
  @override String get unitPcs => 'dona';
  @override String get unitBunch => 'bogʻ';
  @override String get unitPack => 'qadoq';
  @override String get payCash => 'Naqd pul';
  @override String get payCardCourier => 'Kuryerga karta orqali';
  @override String get payKaspi => 'Kaspi oʻtkazmasi';
  @override Map<String, String> get statuses => const {
        'PLACED': 'Yangi',
        'ACCEPTED': 'Qabul qilindi',
        'PICKING': 'Yigʻilmoqda',
        'AWAITING_CUSTOMER': 'Mijoz kutilmoqda',
        'READY': 'Tayyor',
        'COURIER_ASSIGNED': 'Kuryer tayinlandi',
        'DELIVERING': 'Yoʻlda',
        'DELIVERED': 'Yetkazildi',
        'COMPLETED': 'Yakunlandi',
        'CANCELLED': 'Bekor qilindi',
      };
  @override Map<String, String> get roles => const {'OWNER': 'Egasi', 'MANAGER': 'Menejer', 'PICKER': 'Yigʻuvchi', 'COURIER': 'Kuryer'};
  @override Map<String, String> get storeStatuses => const {'PENDING': 'Moderatsiyada', 'SUSPENDED': 'Toʻxtatilgan', 'BLOCKED': 'Bloklangan'};
  @override String get total => 'Jami';
  @override String get estimateNote => 'Taxminan — aniq summa tortilgandan keyin';
  @override String get weigh => 'Tortish';
  @override String get customer => 'Mijoz';
  @override String ordered(String qty) => 'Buyurtma: $qty';
  @override String get weighed => 'Tortildi';
  @override String get changeWeight => 'Vaznni oʻzgartirish';
  @override String get weightGrams => 'Vazn, g';
  @override String sumPreview(String amount) => 'Summa: $amount';
  @override String perKgPrice(String price) => '1 kg — $price';
  @override String get buildRoute => 'Yoʻnalish qurish';
  @override String get merchantCabinet => 'Doʻkon kabineti';
  @override String get phone => 'Telefon';
  @override String get sending => 'Yuborilmoqda…';
  @override String get getCode => 'Kod olish';
  @override String codeSentTo(String phone) => 'Kod $phone raqamiga yuborildi';
  @override String get checking => 'Tekshirilmoqda…';
  @override String get signIn => 'Kirish';
  @override String get changeNumber => 'Raqamni oʻzgartirish';
  @override String get notPartnerYet => 'Hali Kartop hamkori emasmisiz?';
  @override String get becomePartner => 'Hamkor boʻlish';
  @override String get myStores => 'Mening doʻkonlarim';
  @override String get notLinkedToStore => 'Siz hali hech qaysi doʻkonga biriktirilmagansiz';
  @override String get store => 'Doʻkon';
  @override String get switchStore => 'Doʻkonni almashtirish';
  @override String get tabOrders => 'Buyurtmalar';
  @override String get tabProducts => 'Mahsulotlar';
  @override String get tabSettings => 'Sozlamalar';
  @override String get enterPin => 'Kirish uchun PIN kiriting';
  @override String get wrongPin => 'PIN notoʻgʻri';
  @override String get forgotPin => 'PIN esingizdan chiqdimi? Qaytadan kirish';
  @override String get noOrders => 'Hozircha buyurtmalar yoʻq';
  @override String get activeOrders => 'Faol';
  @override String get completedOrders => 'Yakunlangan';
  @override String orderNo(int n) => 'Buyurtma №$n';
  @override String positions(int n) => '$n ta mahsulot';
  @override String get order => 'Buyurtma';
  @override String get error => 'Xatolik';
  @override String weighTitle(String name) => 'Tortish: $name';
  @override String get actualWeight => 'Haqiqiy vazn';
  @override String get cancel => 'Bekor qilish';
  @override String get save => 'Saqlash';
  @override String get pickup => 'Olib ketish';
  @override String get delivery => 'Yetkazib berish';
  @override String district(String d) => 'Tuman: $d';
  @override String get piiHidden => 'Ism, telefon va aniq manzil buyurtma qabul qilingandan keyin ochiladi';
  @override String get callCustomer => 'Qoʻngʻiroq qilish';
  @override String get copyPhone => 'Nusxalash';
  @override String get phoneCopied => 'Raqam nusxalandi';
  @override String get whatsapp => 'WhatsApp';
  @override String get cannotOpen => 'Ilovani ochib boʻlmadi';
  @override String pickupAt(String time) => 'Olib ketish: $time';
  @override String get orderItems => 'Buyurtma tarkibi';
  @override String get needsWeighing => 'tortish kerak';
  @override String get outOfStock => 'Mavjud emas';
  @override String get payOnReceipt => 'Qabul qilishda toʻlov';
  @override String get acceptOrder => 'Buyurtmani qabul qilish';
  @override String get startPicking => 'Yigʻishni boshlash';
  @override String get pickedReady => 'Yigʻildi, tayyor';
  @override String get readyForPickup => 'Berishga tayyor';
  @override String get handToDelivery => 'Yetkazib berishga topshirish';
  @override String get confirmByCode => 'Kod orqali topshirishni tasdiqlash';
  @override String get approxZone => 'Taxminiy hudud';
  @override String handoverNo(int n) => 'Topshirish №$n';
  @override String get askCode => 'Mijozdan kodni soʻrang';
  @override String get askCodeHint => '4 xonali kod xaridor ilovasida. Shu bilan buyurtma uning qoʻliga yetgani tasdiqlanadi.';
  @override String get wrongCode => 'Kod notoʻgʻri, qaytadan urinib koʻring';
  @override String get takePayment => 'Toʻlovni qabul qilish';
  @override String get orderHandedOver => 'Buyurtma topshirildi';
  @override String handedOverText(String amount) => 'Kod tasdiqlandi. $amount toʻlov qabul qilindi. Buyurtma yopildi.';
  @override String get done => 'Tayyor';
  @override String get pricePerKg => '1 kg narxi';
  @override String get pricePerPcs => '1 dona narxi';
  @override String get proposeItem => 'Mahsulot yoki toifa taklif qilish';
  @override String get catalogEmpty => 'Assortiment boʻsh';
  @override String get setPin => 'PIN oʻrnating (4 raqam)';
  @override String get enable => 'Yoqish';
  @override String get pickupReadiness => 'Olib ketishga tayyorlik';
  @override String get pickupReadinessHelper => 'Buyurtmadan necha daqiqa keyin olib ketish mumkin';
  @override String get minutes => 'daq';
  @override String get deliveryAndPickup => 'Yetkazib berish va olib ketish';
  @override String get pickupSubtitle => 'Mijoz buyurtmani oʻzi olib ketadi';
  @override String pickupLeadValue(int n) => 'Rasmiylashtirilgandan keyin $n daq';
  @override String get security => 'Xavfsizlik';
  @override String get appLock => 'Kirishni himoyalash';
  @override String get appLockSubtitle => 'Ochishda Face ID / barmoq izi yoki PIN';
  @override String get logout => 'Akkauntdan chiqish';
  @override String get language => 'Til';
  @override String get applicationAccepted => 'Ariza qabul qilindi!';
  @override String get partnerSuccessText => 'Doʻkoningizni Kartop’ga ulash uchun siz bilan telefon orqali bogʻlanamiz. Odatda bir ish kuni ichida.';
  @override String get backToLogin => 'Kirishga qaytish';
  @override String get partnerTitle => 'Doʻkoningizni onlaynga olib chiqing';
  @override String get partnerIntro => 'Kontaktlaringizni qoldiring — doʻkoningizni Kartop’ga ulashga yordam beramiz. Ulanish taklif boʻyicha.';
  @override String get yourName => 'Ismingiz';
  @override String get yourNameHint => 'Sizga qanday murojaat qilaylik';
  @override String get companyName => 'Kompaniya nomi';
  @override String get companyHint => 'Masalan, «Ruslanning mevalari»';
  @override String get twogisLink => '2GIS havolasi';
  @override String get sendApplication => 'Ariza yuborish';
  @override String get consent => 'Tugmani bosish orqali siz bogʻlanish uchun kontakt maʼlumotlaringizni qayta ishlashga rozilik bildirasiz.';
  @override String get optionalSuffix => ' — ixtiyoriy';
  @override String get catalogRequestTitle => 'Katalogga ariza';
  @override String get requestSent => 'Ariza yuborildi!';
  @override String get requestSentText => 'Platforma uni koʻrib chiqadi. Tasdiqlangandan soʻng mahsulot katalogda paydo boʻladi va uni assortimentingizga qoʻsha olasiz.';
  @override String get proposeTitle => 'Umumiy katalog uchun mahsulot taklif qiling';
  @override String get product => 'Mahsulot';
  @override String get category => 'Toifa';
  @override String get productName => 'Mahsulot nomi';
  @override String get categoryName => 'Toifa nomi';
  @override String get productHint => 'Masalan, «Fuji olmasi»';
  @override String get categoryHint => 'Masalan, «Yongʻoqlar»';
  @override String get unit => 'Oʻlchov birligi';
  @override String get categoryIfKnown => 'Toifa (agar bilsangiz)';
  @override String get categoryOptHint => 'Masalan, «Olmalar» — ixtiyoriy';
  @override String get comment => 'Izoh';
  @override String get optional => 'Ixtiyoriy';
  @override String get enterName => 'Nomini kiriting';
}
