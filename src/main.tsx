import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { exposeDebugHooks } from '@/debug'
import { initI18n } from '@/i18n'
import { appStore } from '@/store'

exposeDebugHooks(appStore.getState)

void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
        <TooltipProvider>
          <App />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
