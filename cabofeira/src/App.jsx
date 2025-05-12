import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Categories from "./pages/Categories";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/categories" element={<Categories />} />
        {/* Meer routes komen hier later */}
      </Routes>
    </Router>
  );
}

export default App;
