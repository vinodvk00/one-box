import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout/Layout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Dashboard } from "@/pages/Dashboard";
import { Emails } from "@/pages/Emails";
import { EmailDetail } from "@/pages/EmailDetail";
import { Search } from "@/pages/Search";
import { Training } from "@/pages/Training";
import { Settings } from "@/pages/Settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OAuthCallback from "@/pages/OAuthCallback";
import "./index.css";
import "./styles/email.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="onebox-ui-theme">
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="emails" element={<Emails />} />
              <Route path="emails/:id" element={<EmailDetail />} />
              <Route path="search" element={<Search />} />
              <Route path="training" element={<Training />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>
);
