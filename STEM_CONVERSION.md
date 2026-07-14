# Пересчет граммовых вязок в стебли

В строках AMMA вида `500g/вяз`, `800G/扎`, `1000g/bun` цена задана за весовую вязку, а не за указанное количество стеблей. Для таких строк сайт использует базовый оптовый стандарт:

```text
1 вязка = 10 стеблей
стеблей на 1 кг = 10 / (грамм в вязке / 1000)
цена за стебель = цена за короб с доставкой / (банчей в коробе * 10)
```

Примеры:

| Упаковка | Стеблей на 1 кг | Стеблей в вязке |
|---|---:|---:|
| 1000g | 10.0 | 10 |
| 900g | 11.1 | 10 |
| 800g | 12.5 | 10 |
| 700g | 14.3 | 10 |
| 600g | 16.7 | 10 |
| 500g | 20.0 | 10 |
| 350g | 28.6 | 10 |
| 300g | 33.3 | 10 |
| 250g | 40.0 | 10 |
| 200g | 50.0 | 10 |
| 130g | 76.9 | 10 |

Источники для базового стандарта 10 стеблей в оптовой вязке:

- Lisianthus/Eustoma and Campanula examples: https://flowerwholesale.com/lisianthus/ and https://flowerwholesale.com/campanula-white/
- Gypsophila, Hypericum, Eucalyptus examples: https://www.danisaflowers.com/gypsophila-million-star.html, https://www.danisaflowers.com/hypericum-brown.html, https://www.danisaflowers.com/eucalyptus-seeded.html
- Statice examples: https://www.flowersandfancies.com/bulk-flowers/statice/ and https://www.diyflowermart.com/shop/p/statice
- Mixed seasonal wholesale list with many 10-stem bunches: https://beeswingfarm.com/wholesale-florals-by-season-costs/

Фактическое число стеблей в 1 кг может отличаться по длине, толщине и поставщику. Если AMMA даст точные нормы по конкретной позиции, лучше заменить базовые 10 стеблей на их значение.
