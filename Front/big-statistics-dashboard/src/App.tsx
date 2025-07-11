import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect, ReactNode } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import CustomerOrdersInformation from './pages/Orders/CustomerOrdersInformation';
import Plan from './pages/Plan/Plan';
import LoginPage from './pages/LoginPage/LoginPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuth = localStorage.getItem('isAuth') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function AppContent() {
    const [expanded, setExpanded] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem("sidebarExpanded") ?? "true")
    );
    const location = useLocation();
    const isAuth = localStorage.getItem('isAuth') === 'true';
    const isLoginPage = location.pathname === "/login";

    const toggle = () => {
        setExpanded((prev) => {
            localStorage.setItem("sidebarExpanded", JSON.stringify(!prev));
            return !prev;
        });
    };

    useEffect(() => {
        const handler = () => toggle();
        window.addEventListener("toggleSidebar", handler);
        return () => window.removeEventListener("toggleSidebar", handler);
    }, []);

    // Если авторизован и на /login — редирект на /
    if (isAuth && isLoginPage) {
      return <Navigate to="/" replace />;
    }

    if (isLoginPage) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
            </Routes>
        );
    }

    return (
        <div className="flex h-screen">
            <Sidebar expanded={expanded} toggleSidebar={toggle} />
            <main className="flex-1 p-4 overflow-auto bg-gray-15">
                <Routes>
                    <Route path="/" element={<RequireAuth><CustomerOrdersInformation /></RequireAuth>} />
                    <Route path="/uncompleted-orders" element={<RequireAuth><CustomerOrdersInformation /></RequireAuth>} />
                    <Route path="/plan" element={<RequireAuth><Plan /></RequireAuth>} />
                </Routes>
            </main>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;
