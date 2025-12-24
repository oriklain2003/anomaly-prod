import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RouteCheckPage } from './components/RouteCheckPage';
import { PasswordLock } from './components/PasswordLock';

function App() {
  return (
    <PasswordLock>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />} />
          <Route path="/route-check" element={<RouteCheckPage />} />
        </Routes>
      </BrowserRouter>
    </PasswordLock>
  );
}

export default App;
