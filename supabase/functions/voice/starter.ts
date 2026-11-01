/** Ready-made dishes (ingredients for about 4) so families don't start from a blank page. They can edit any of them. */
export const STARTER_DISHES: { name: string; ingredients: string[] }[] = [
  // South Indian
  { name: 'Idli & sambar', ingredients: ['idli batter', 'toor dal', 'onion', 'tomatoes', 'sambar powder', 'tamarind', 'mixed vegetables', 'curry leaves', 'mustard seeds'] },
  { name: 'Dosa & chutney', ingredients: ['dosa batter', 'coconut', 'roasted chana dal', 'green chillies', 'curry leaves', 'mustard seeds', 'oil'] },
  { name: 'Sambar rice', ingredients: ['rice', 'toor dal', 'onion', 'tomatoes', 'sambar powder', 'tamarind', 'drumsticks', 'curry leaves'] },
  { name: 'Rasam', ingredients: ['toor dal', 'tomatoes', 'tamarind', 'rasam powder', 'garlic', 'coriander', 'curry leaves'] },
  { name: 'Upma', ingredients: ['rava', 'onion', 'green chillies', 'ginger', 'curry leaves', 'mustard seeds', 'urad dal'] },
  { name: 'Pongal', ingredients: ['rice', 'moong dal', 'ghee', 'black pepper', 'cumin seeds', 'ginger', 'cashews'] },
  { name: 'Lemon rice', ingredients: ['rice', 'lemons', 'peanuts', 'curry leaves', 'green chillies', 'mustard seeds', 'turmeric'] },
  { name: 'Curd rice', ingredients: ['rice', 'yoghurt', 'milk', 'ginger', 'green chillies', 'curry leaves', 'mustard seeds'] },
  { name: 'Vegetable kurma & chapati', ingredients: ['atta', 'mixed vegetables', 'coconut', 'onion', 'tomatoes', 'garam masala', 'cashews'] },
  // North Indian
  { name: 'Dal tadka & rice', ingredients: ['toor dal', 'rice', 'onion', 'tomatoes', 'garlic', 'cumin seeds', 'ghee', 'coriander'] },
  { name: 'Rajma chawal', ingredients: ['kidney beans', 'rice', 'onion', 'tomatoes', 'ginger', 'garlic', 'garam masala'] },
  { name: 'Chana masala', ingredients: ['chickpeas', 'onion', 'tomatoes', 'ginger', 'garlic', 'chana masala powder', 'coriander'] },
  { name: 'Aloo gobi', ingredients: ['potatoes', 'cauliflower', 'onion', 'tomatoes', 'cumin seeds', 'turmeric', 'coriander'] },
  { name: 'Palak paneer', ingredients: ['spinach', 'paneer', 'onion', 'tomatoes', 'garlic', 'ginger', 'cream', 'garam masala'] },
  { name: 'Paneer butter masala', ingredients: ['paneer', 'tomatoes', 'onion', 'butter', 'cream', 'cashews', 'kasuri methi', 'garam masala'] },
  { name: 'Chicken curry', ingredients: ['chicken', 'onion', 'tomatoes', 'ginger', 'garlic', 'yoghurt', 'garam masala', 'coriander'] },
  { name: 'Chicken biryani', ingredients: ['chicken', 'basmati rice', 'onion', 'yoghurt', 'mint', 'coriander', 'biryani masala', 'ghee'] },
  { name: 'Vegetable biryani', ingredients: ['basmati rice', 'mixed vegetables', 'onion', 'yoghurt', 'mint', 'biryani masala', 'ghee'] },
  { name: 'Egg curry', ingredients: ['eggs', 'onion', 'tomatoes', 'ginger', 'garlic', 'garam masala', 'coriander'] },
  { name: 'Jeera rice', ingredients: ['basmati rice', 'cumin seeds', 'ghee'] },
  { name: 'Vegetable pulao', ingredients: ['basmati rice', 'mixed vegetables', 'onion', 'whole spices', 'ghee'] },
  { name: 'Aloo paratha', ingredients: ['atta', 'potatoes', 'green chillies', 'coriander', 'butter', 'yoghurt'] },
  { name: 'Poha', ingredients: ['poha', 'onion', 'potatoes', 'peanuts', 'curry leaves', 'lemons', 'turmeric'] },
  { name: 'Chapati', ingredients: ['atta', 'ghee'] },
  { name: 'Plain rice', ingredients: ['rice'] },
  // British and everyday
  { name: 'Spaghetti bolognese', ingredients: ['spaghetti', 'beef mince', 'onion', 'garlic', 'chopped tomatoes', 'carrots', 'cheese'] },
  { name: 'Pasta in tomato sauce', ingredients: ['pasta', 'chopped tomatoes', 'onion', 'garlic', 'cheese', 'basil'] },
  { name: 'Roast chicken dinner', ingredients: ['whole chicken', 'potatoes', 'carrots', 'broccoli', 'gravy granules', 'stuffing'] },
  { name: "Shepherd's pie", ingredients: ['lamb mince', 'potatoes', 'onion', 'carrots', 'peas', 'butter', 'milk', 'stock cubes'] },
  { name: 'Fish fingers, chips & peas', ingredients: ['fish fingers', 'oven chips', 'frozen peas', 'ketchup'] },
  { name: 'Homemade pizza', ingredients: ['pizza bases', 'passata', 'mozzarella', 'peppers', 'sweetcorn'] },
  { name: 'Jacket potato & beans', ingredients: ['baking potatoes', 'baked beans', 'cheese', 'butter'] },
  { name: 'Veg fried rice', ingredients: ['rice', 'eggs', 'frozen peas', 'carrots', 'spring onions', 'soy sauce'] },
  { name: 'Noodle stir-fry', ingredients: ['noodles', 'peppers', 'carrots', 'spring onions', 'soy sauce', 'garlic'] },
  { name: 'Chicken wraps', ingredients: ['tortilla wraps', 'chicken', 'lettuce', 'tomatoes', 'cheese', 'yoghurt'] },
  { name: 'Sandwiches', ingredients: ['bread', 'cheese', 'cucumber', 'butter', 'ham'] },
  // Breakfast
  { name: 'Porridge', ingredients: ['oats', 'milk', 'bananas', 'honey'] },
  { name: 'Cereal & milk', ingredients: ['cereal', 'milk'] },
  { name: 'Toast & eggs', ingredients: ['bread', 'eggs', 'butter'] },
  { name: 'Pancakes', ingredients: ['flour', 'eggs', 'milk', 'butter', 'maple syrup'] },
  { name: 'Masala omelette', ingredients: ['eggs', 'onion', 'tomatoes', 'green chillies', 'coriander'] },
]

/** Things nearly every kitchen already has: they start as "Have it" on the review list. */
export const PANTRY_STAPLES = new Set([
  'salt', 'oil', 'water', 'sugar', 'turmeric', 'chilli powder', 'cumin seeds', 'mustard seeds', 'garam masala',
  'black pepper', 'ghee', 'butter', 'soy sauce', 'ketchup', 'whole spices', 'sambar powder', 'rasam powder', 'kasuri methi',
  'biryani masala', 'chana masala powder', 'honey', 'stock cubes', 'gravy granules', 'flour', 'atta', 'rice', 'basmati rice', 'urad dal',
])
