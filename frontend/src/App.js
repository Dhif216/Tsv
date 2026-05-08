import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LangProvider } from "./contexts/LangContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import WorkerForm from "./pages/WorkerForm";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import "./App.css";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm uppercase tracking-[0.2em] font-bold animate-pulse">
          Loading…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<WorkerForm />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}

export default App;
