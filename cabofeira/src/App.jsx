import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import PostAd from "./pages/PostAd";
import Footer from "./components/Footer";


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/postad" element={<PostAd />} />

        {/* Meer routes komen hier later */}
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
