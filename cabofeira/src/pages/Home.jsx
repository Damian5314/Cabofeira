import React from "react";
import "./Home.css";
import CategoryList from "../components/CategoryList";

function Home() {
  return (
    <>
        <div className="hero-section">
        <div className="overlay">
            <h1>Search for… <span className="highlight">anything</span> with CaboFeira!</h1>
            <p>Get to know CaboFeira and be free to post anything and sell it.</p>
            <p>Earn extra with what you no longer use.</p>
            <div className="search-bar">
            <input type="text" placeholder="What are you looking for?" />
            <input type="text" placeholder="Location" />
            <select>
                <option>All Categories</option>
            </select>
            <button>Search</button>
            </div>
        </div>
        </div>
        <CategoryList />
    </>
  );
}

export default Home;
