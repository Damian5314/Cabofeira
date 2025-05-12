import React from "react";
import "./CategoryList.css";

const categories = {
  "Bicycles and Mopeds": ["Aprilia", "Bicycle Accessories", "Bicycle Parts"],
  "Car Parts & Accessories": ["Air Conditioning and Heating", "Battery", "Body and Sheet Metal"],
  "Cell Phones": ["Accessories", "Bluetooth Accessories", "Smart Phones"],
  "Computers": ["Accessories", "Laptops", "Tablets"],
};

function CategoryList() {
  return (
    <div className="category-section">
      <h2>Ad Categories</h2>
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

export default CategoryList;
