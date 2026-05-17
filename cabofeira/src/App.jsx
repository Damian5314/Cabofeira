import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { AuthProvider } from "./context/AuthContext";
import { ProductsProvider } from "./context/ProductsContext";

import Home from "./pages/Home";
import Categories from "./pages/Categories";
import Search from "./pages/Search";
import ProductDetail from "./pages/ProductDetail";
import PostAd from "./pages/PostAd";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import MyAds from "./pages/MyAds";
import Favorites from "./pages/Favorites";
import Messages from "./pages/Messages";
import { About, Contact, FAQ, NotFound } from "./pages/Info";

function App() {
  return (
    <AuthProvider>
      <ProductsProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/search" element={<Search />} />
            <Route path="/product/:id" element={<ProductDetail />} />

            <Route path="/postad" element={<PostAd />} />
            <Route path="/edit/:id" element={<PostAd />} />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/ads" element={<MyAds />} />
            <Route path="/profile/settings" element={<Profile />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/messages" element={<Messages />} />

            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </Router>
      </ProductsProvider>
    </AuthProvider>
  );
}

export default App;
