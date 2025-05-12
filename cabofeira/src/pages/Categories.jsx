import React from "react";
import "./Categories.css";

const categories = {
  "Bicycles and Mopeds": ["Aprilia", "Bicycle Accessories", "Bicycle Parts"],
  "Cars & Trucks": ["Abarth", "Alfa Romeo", "BMW"],
  "Clothing and Shoes": ["Clothing Children", "Clothing Gentlemen", "Clothing Ladies"],
  "Video Games": ["Playstation", "Nintendo", "Game Accessories"],
  // Voeg hier meer toe
};

function Categories() {
  return (
    <div className="categories-container">
      <h1>Ad Categories</h1>
      <div className="category-columns">
        {Object.entries(categories).map(([group, items]) => (
          <div key={group} className="category-group">
            <h3>{group}</h3>
            <ul>
              {items.map((item) => (
                <li key={item}>
                  <a href="#">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Categories;
