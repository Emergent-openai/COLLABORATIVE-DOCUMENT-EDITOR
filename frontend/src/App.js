import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import EditorWorkspace from "@/components/editor/EditorWorkspace";
import PublishedView from "@/components/editor/PublishedView";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EditorWorkspace />} />
          <Route path="/published" element={<PublishedView />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "!border-white/50 !bg-white/85 !text-slate-900 !shadow-2xl",
          }}
        />
      </BrowserRouter>
    </div>
  );
}

export default App;
