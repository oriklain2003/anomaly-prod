import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RouteCheckPage } from './components/RouteCheckPage';
import { AircraftModelsPage } from './components/AircraftModelsPage';
import { TrajectoryPlannerPage } from './components/TrajectoryPlannerPage';
import { PasswordLock } from './components/PasswordLock';

function App() {
  return (
    <PasswordLock>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />} />
          <Route path="/route-check" element={<RouteCheckPage />} />
          <Route path="/trajectory-planner" element={<TrajectoryPlannerPage />} />
          <Route path="/aircraft-models" element={<AircraftModelsPage />} />
        </Routes>
      </BrowserRouter>
    </PasswordLock>
  );
}

export default App;
