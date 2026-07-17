import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        RR v7 wraps location updates in startTransition by default.
        Kakao map + geolocation keep scheduling higher-priority work, so tab
        navigations update window.location but never flush React location —
        UI stays on 즐겨찾기 while the URL shows /symptom. Opt out.
      */}
      <BrowserRouter unstable_useTransitions={false}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
