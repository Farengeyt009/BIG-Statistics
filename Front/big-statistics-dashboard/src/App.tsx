import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import CustomerOrdersInformation from './pages/Orders/CustomerOrdersInformation';
import Plan from './pages/Plan/Plan';

function App() {
    const [expanded, setExpanded] = useState<boolean>(() =>
        JSON.parse(localStorage.getItem("sidebarExpanded") ?? "true")
    );

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

    return (
        <BrowserRouter>
            <div className="flex h-screen">
                <Sidebar expanded={expanded} toggleSidebar={toggle} />
                <main className="flex-1 p-4 overflow-auto bg-gray-15">
                    <Routes>
                        <Route path="/" element={<CustomerOrdersInformation />} />
                        <Route path="/uncompleted-orders" element={<CustomerOrdersInformation />} />
                        <Route path="/plan" element={<Plan />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
