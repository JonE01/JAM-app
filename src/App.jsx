import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import NavBar from './components/layout/NavBar';
import Home from './pages/Home';
import UpcomingDates from './pages/UpcomingDates';
import OurPhotos from './pages/OurPhotos';
import DateIdeas from './pages/DateIdeas';
import OurPlaces from './pages/OurPlaces';

export default function App() {
  const location = useLocation();

  return (
    <>
      <NavBar />
      <main className="page-wrapper">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"        element={<Home />} />
            <Route path="/dates"   element={<UpcomingDates />} />
            <Route path="/photos"  element={<OurPhotos />} />
            <Route path="/ideas"   element={<DateIdeas />} />
            <Route path="/places"  element={<OurPlaces />} />
          </Routes>
        </AnimatePresence>
      </main>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
          },
          success: { iconTheme: { primary: '#C0606A', secondary: '#FAF6F0' } },
        }}
      />
    </>
  );
}
