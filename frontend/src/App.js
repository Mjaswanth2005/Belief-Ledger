import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/theme";

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-cream text-ink font-sans">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--c-surface)',
              color: 'var(--c-ink)',
              border: '2px solid var(--c-ink)',
              borderRadius: '12px',
              boxShadow: '4px 4px 0 0 var(--c-shadow)',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
            }
          }}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
