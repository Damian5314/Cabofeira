// Marketplace categories with subcategories and icons (emoji-based for simplicity)
export const categories = [
  {
    id: "vehicles",
    name: "Vehicles",
    icon: "🚗",
    subcategories: ["Cars", "Motorcycles", "Trucks", "Boats", "Car Parts & Accessories", "Bicycles"],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    icon: "🏠",
    subcategories: ["Houses for Sale", "Houses for Rent", "Apartments", "Land", "Commercial", "Vacation Rentals"],
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: "📱",
    subcategories: ["Cell Phones", "Computers & Laptops", "Tablets", "TV & Audio", "Cameras", "Gaming"],
  },
  {
    id: "home-garden",
    name: "Home & Garden",
    icon: "🛋️",
    subcategories: ["Furniture", "Kitchen & Dining", "Appliances", "Decor", "Garden Tools", "Lighting"],
  },
  {
    id: "fashion",
    name: "Fashion & Beauty",
    icon: "👗",
    subcategories: ["Women's Clothing", "Men's Clothing", "Shoes", "Bags & Accessories", "Jewelry", "Cosmetics"],
  },
  {
    id: "jobs",
    name: "Jobs",
    icon: "💼",
    subcategories: ["Full-time", "Part-time", "Internships", "Freelance", "Tourism & Hospitality", "Construction"],
  },
  {
    id: "services",
    name: "Services",
    icon: "🛠️",
    subcategories: ["Tutoring", "Cleaning", "Transport", "Events", "Beauty", "Repair & Maintenance"],
  },
  {
    id: "animals",
    name: "Animals",
    icon: "🐾",
    subcategories: ["Dogs", "Cats", "Birds", "Fish", "Livestock", "Pet Supplies"],
  },
  {
    id: "sports-hobbies",
    name: "Sports & Hobbies",
    icon: "⚽",
    subcategories: ["Fitness", "Football", "Surf & Water Sports", "Music Instruments", "Books", "Art & Collectibles"],
  },
  {
    id: "food-agriculture",
    name: "Food & Agriculture",
    icon: "🌽",
    subcategories: ["Fresh Produce", "Fish & Seafood", "Local Products", "Seeds & Plants", "Farm Equipment"],
  },
  {
    id: "baby-kids",
    name: "Baby & Kids",
    icon: "👶",
    subcategories: ["Toys", "Strollers", "Baby Clothes", "Kids Furniture", "School Supplies"],
  },
  {
    id: "other",
    name: "Other",
    icon: "📦",
    subcategories: ["Free Stuff", "Lost & Found", "Miscellaneous"],
  },
];

export const getCategoryById = (id) => categories.find((c) => c.id === id);
