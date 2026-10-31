/** Rough grocery categoriser by keyword. Unknown items go to "Other"; parents can retype the category later. */
const RULES: [string, RegExp][] = [
  ['Fruit & veg', /\b(apple|banana|orange|grape|berr|melon|mango|pear|plum|peach|lemon|lime|avocado|tomato|potato|onion|garlic|carrot|broccoli|cauliflower|spinach|lettuce|salad|cucumber|pepper|courgette|aubergine|mushroom|corn|peas|beans|herb|coriander|basil|ginger|chilli|veg|fruit)\w*/i],
  ['Dairy & eggs', /\b(milk|cheese|butter|yog|cream|egg|paneer|ghee|curd)\w*/i],
  ['Bakery', /\b(bread|loaf|roll|bagel|bun|naan|pitta|croissant|cake|muffin|wrap|tortilla)\w*/i],
  ['Meat & fish', /\b(chicken|beef|lamb|pork|mince|sausage|bacon|ham|fish|salmon|tuna|prawn|turkey)\w*/i],
  ['Cupboard', /\b(rice|pasta|noodle|flour|sugar|salt|oil|sauce|spice|masala|dal|lentil|cereal|oat|tea|coffee|biscuit|crisp|snack|tin|can|stock|honey|jam|nut)\w*/i],
  ['Frozen', /\b(frozen|ice cream|lolly|pizza|chips)\w*/i],
  ['Drinks', /\b(juice|squash|water|cola|lemonade|drink|beer|wine)\w*/i],
  ['Household', /\b(dishwasher|washing|detergent|soap|shampoo|toothpaste|toothbrush|tissue|toilet|kitchen roll|bin bag|cleaner|spray|sponge|candle|battery|nappy|wipes)\w*/i],
]

export function categorise(text: string): string {
  for (const [cat, re] of RULES) if (re.test(text)) return cat
  return 'Other'
}

export const CATEGORY_ORDER = ['Fruit & veg', 'Dairy & eggs', 'Bakery', 'Meat & fish', 'Cupboard', 'Frozen', 'Drinks', 'Household', 'Other']
