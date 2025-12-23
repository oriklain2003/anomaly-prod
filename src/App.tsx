import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RouteCheckPage } from './components/RouteCheckPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />} />
        <Route path="/route-check" element={<RouteCheckPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
