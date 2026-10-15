import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { AppShell, RequireAuth } from './components/AppShell'
import { Spinner } from './components/States'
import { AuthProvider } from './context/auth'
import { PresenceProvider } from './context/presence'
import { ToastProvider } from './context/toast'
import Landing from './pages/Landing'

// Landing no bundle principal; o resto carrega sob demanda
const Explore = lazy(() => import('./pages/Explore'))
const TitleDetail = lazy(() => import('./pages/TitleDetail'))
const ListPage = lazy(() => import('./pages/ListPage'))
const Match = lazy(() => import('./pages/Match'))
const Profile = lazy(() => import('./pages/Profile'))
const MyLists = lazy(() => import('./pages/Profile').then((m) => ({ default: m.MyLists })))
const Settings = lazy(() => import('./pages/Settings'))
const Feed = lazy(() => import('./pages/Social').then((m) => ({ default: m.Feed })))
const Community = lazy(() => import('./pages/Social').then((m) => ({ default: m.Community })))
const StaticPage = lazy(() => import('./pages/Static'))
const NotFound = lazy(() => import('./pages/Static').then((m) => ({ default: m.NotFound })))
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })))
const Welcome = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Welcome })))

/** Provedores que precisam do contexto do roteador (presença lê a rota atual). */
function Root() {
  return (
    <ToastProvider>
      <PresenceProvider>
        <Suspense
          fallback={
            <div className="page-center">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </PresenceProvider>
    </ToastProvider>
  )
}

export const routes = [
  {
    element: <Root />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/entrar', element: <Login /> },
      { path: '/cadastro', element: <Register /> },
      { path: '/boas-vindas', element: <Welcome /> },
      {
        element: <AppShell />,
        children: [
          { path: '/explorar', element: <Explore /> },
          { path: '/titulo/:id', element: <TitleDetail /> },
          { path: '/comunidade', element: <Community /> },
          { path: '/match', element: <Match /> },
          { path: '/u/:username', element: <Profile /> },
          { path: '/listas', element: <MyLists /> },
          { path: '/listas/:id', element: <ListPage /> },
          { path: '/feed', element: <RequireAuth><Feed /></RequireAuth> },
          { path: '/configuracoes', element: <RequireAuth><Settings /></RequireAuth> },
          { path: '/sobre', element: <StaticPage slug="sobre" /> },
          { path: '/contato', element: <StaticPage slug="contato" /> },
          { path: '/privacidade', element: <StaticPage slug="privacidade" /> },
          { path: '/termos', element: <StaticPage slug="termos" /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
