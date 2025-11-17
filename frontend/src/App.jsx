import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import AdminPage from "./pages/AdminPage";
import TeamsPage from "./pages/TeamsPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;