import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Persons } from './pages/Persons';
import { BatchProcess } from './pages/BatchProcess';
import { Review } from './pages/Review';
import { Settings } from './pages/Settings';
import './index.css';

// Report 页包含 recharts，按路由分包懒加载
const Report = lazy(() => import('./pages/Report').then(m => ({ default: m.Report })));

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/persons" element={<Persons />} />
            <Route path="/batch" element={<BatchProcess />} />
            <Route path="/review/:taskId?" element={<Review />} />
            <Route path="/report/:taskId?" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
