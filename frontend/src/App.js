import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="scanlines min-h-screen bg-void text-ink-primary font-mono">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#050505',
            color: '#FFB000',
            border: '1px solid #FFB000',
            borderRadius: 0,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
          }
        }}
      />
    </div>
  );
}

export default App;
