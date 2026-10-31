import { Controller, Get } from '@nestjs/common';

// Дерево категорий всего зелёного базара (перенести в БД/сид миграции).
const CATEGORIES = [
  { key: 'vegetables', ru: 'Овощи' },
  { key: 'fruits', ru: 'Фрукты' },
  { key: 'greens', ru: 'Зелень и травы' },
  { key: 'berries', ru: 'Ягоды' },
  { key: 'dried', ru: 'Сухофрукты' },
  { key: 'nuts', ru: 'Орехи и семечки' },
  { key: 'meat', ru: 'Мясо', perishable: true, coldChain: true },
  { key: 'poultry', ru: 'Птица', perishable: true, coldChain: true },
  { key: 'dairy', ru: 'Молочное и сыры', perishable: true, coldChain: true },
  { key: 'korean_salads', ru: 'Корейские салаты', perishable: true },
  { key: 'pickles', ru: 'Соленья и квашеное', perishable: true },
  { key: 'grocery', ru: 'Бакалея' },
  { key: 'eggs', ru: 'Яйца' },
  { key: 'bakery', ru: 'Лепёшки и выпечка' },
];

@Controller('catalog')
export class CatalogController {
  @Get('categories')
  categories() {
    return CATEGORIES;
  }
}
