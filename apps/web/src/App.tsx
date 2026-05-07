import { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Analyze from './pages/Analyze';
import Download from './pages/Download';

function getRoute(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (route === '/analyze') {
    return <Analyze />;
  }

  if (route === '/download') {
    return <Download />;
  }

  return <Landing />;
}
