const categories = [
  ['vegetables', ['vegetable', 'fruit']], ['fashion', ['cloth', 'fashion']],
  ['electronics', ['electronic', 'mobile']], ['pharmacy', ['pharmacy', 'health']],
  ['bakery', ['bakery']], ['restaurant', ['food', 'dining', 'cafe', 'restaurant']],
  ['hardware', ['hardware', 'electrical']], ['beauty', ['beauty', 'cosmetic', 'salon']],
  ['home', ['home', 'furniture']], ['stationery', ['stationery', 'book']],
  ['jewellery', ['jewellery', 'jewelry']], ['automotive', ['auto', 'vehicle', 'bike']],
  ['pets', ['pet']], ['education', ['education', 'tuition', 'school']],
  ['fitness', ['fitness', 'gym', 'sports']], ['services', ['service', 'repair', 'professional']],
  ['grocery', ['grocery', 'supermarket', 'general']],
];
const categoryIds = new Set(['all', 'others', ...categories.map(([id]) => id)]);
// All SQL fragments are fixed source constants; user input remains a bound parameter.
const categorySql = `CASE ${categories.map(([id, words]) =>
  `WHEN ${words.map((word) => `LOWER(COALESCE(s.category, '')) LIKE '%${word}%'`).join(' OR ')} THEN '${id}'`
).join(' ')} ELSE 'others' END`;
module.exports = { categorySql, categoryIds };
