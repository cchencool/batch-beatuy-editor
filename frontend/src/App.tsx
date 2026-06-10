import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Persons } from './pages/Persons';
import { BatchProcess } from './pages/BatchProcess';
import { Review } from './pages/Review';
import { Report } from './pages/Report';
import { Settings } from './pages/Settings';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/batch" element={<BatchProcess />} />
          <Route path="/review/:taskId?" element={<Review />} />
          <Route path="/report/:taskId?" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
