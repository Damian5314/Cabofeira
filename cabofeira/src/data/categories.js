// Marketplace categories. Icons come from react-icons (Material Design set).
import React from "react";
import {
  MdDirectionsCar,
  MdHome,
  MdSmartphone,
  MdChair,
  MdCheckroom,
  MdWork,
  MdHandyman,
  MdPets,
  MdSportsSoccer,
  MdRestaurant,
  MdChildCare,
  MdInventory2,
} from "react-icons/md";

export const categories = [
  {
    id: "vehicles",
    name: "Vehicles",
    icon: MdDirectionsCar,
    color: "#EF4444",
    subcategories: ["Cars", "Motorcycles", "Trucks", "Boats", "Car Parts & Accessories", "Bicycles"],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    icon: MdHome,
    color: "#3B82F6",
    subcategories: ["Houses for Sale", "Houses for Rent", "Apartments", "Land", "Commercial", "Vacation Rentals"],
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: MdSmartphone,
    color: "#6366F1",
    subcategories: ["Cell Phones", "Computers & Laptops", "Tablets", "TV & Audio", "Cameras", "Gaming"],
  },
  {
    id: "home-garden",
    name: "Home & Garden",
    icon: MdChair,
    color: "#10B981",
    subcategories: ["Furniture", "Kitchen & Dining", "Appliances", "Decor", "Garden Tools", "Lighting"],
  },
  {
    id: "fashion",
    name: "Fashion & Beauty",
    icon: MdCheckroom,
    color: "#EC4899",
    subcategories: ["Women's Clothing", "Men's Clothing", "Shoes", "Bags & Accessories", "Jewelry", "Cosmetics"],
  },
  {
    id: "jobs",
    name: "Jobs",
    icon: MdWork,
    color: "#92400E",
    subcategories: ["Full-time", "Part-time", "Internships", "Freelance", "Tourism & Hospitality", "Construction"],
  },
  {
    id: "services",
    name: "Services",
    icon: MdHandyman,
    color: "#F59E0B",
    subcategories: ["Tutoring", "Cleaning", "Transport", "Events", "Beauty", "Repair & Maintenance"],
  },
  {
    id: "animals",
    name: "Animals",
    icon: MdPets,
    color: "#A16207",
    subcategories: ["Dogs", "Cats", "Birds", "Fish", "Livestock", "Pet Supplies"],
  },
  {
    id: "sports-hobbies",
    name: "Sports & Hobbies",
    icon: MdSportsSoccer,
    color: "#059669",
    subcategories: ["Fitness", "Football", "Surf & Water Sports", "Music Instruments", "Books", "Art & Collectibles"],
  },
  {
    id: "food-agriculture",
    name: "Food & Agriculture",
    icon: MdRestaurant,
    color: "#65A30D",
    subcategories: ["Fresh Produce", "Fish & Seafood", "Local Products", "Seeds & Plants", "Farm Equipment"],
  },
  {
    id: "baby-kids",
    name: "Baby & Kids",
    icon: MdChildCare,
    color: "#FB923C",
    subcategories: ["Toys", "Strollers", "Baby Clothes", "Kids Furniture", "School Supplies"],
  },
  {
    id: "other",
    name: "Other",
    icon: MdInventory2,
    color: "#6B7280",
    subcategories: ["Free Stuff", "Lost & Found", "Miscellaneous"],
  },
];

export const getCategoryById = (id) => categories.find((c) => c.id === id);

// Render helper so consumers don't need to destructure the icon component themselves.
export function CategoryIcon({ category, size = 24, style, ...rest }) {
  if (!category?.icon) return null;
  const Icon = category.icon;
  return <Icon size={size} style={{ color: category.color, ...style }} {...rest} />;
}
