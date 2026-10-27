import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AppDataProvider } from './AppData.jsx';
import Layout from './components/Layout.jsx';
import Today from './pages/Today.jsx';
import Stylist from './pages/Stylist.jsx';
import Wardrobe from './pages/Wardrobe.jsx';
import Outfits from './pages/Outfits.jsx';
import Week from './pages/Week.jsx';
import Saved from './pages/Saved.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppDataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="stylist" element={<Stylist />} />
            <Route path="wardrobe" element={<Wardrobe />} />
            <Route path="outfits" element={<Outfits />} />
            <Route path="week" element={<Week />} />
            <Route path="saved" element={<Saved />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
