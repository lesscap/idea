import { BrowserRouter, useRoutes } from 'react-router-dom'
import { routes } from './routes.tsx'

const Shell = () => useRoutes(routes)

export const App = () => (
  <BrowserRouter>
    <Shell />
  </BrowserRouter>
)
