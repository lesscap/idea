import type { RouteObject } from 'react-router-dom'
import { HomePage } from '../pages/home.tsx'

export const routes: RouteObject[] = [{ path: '/', element: <HomePage /> }]
