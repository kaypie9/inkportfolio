import './globals.css'
import type { ReactNode } from 'react'
import { InkWagmiProvider } from './ink-wagmi-provider'

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem('ink-theme')
    const theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.body.dataset.theme = theme
  } catch (e) {}
})()
`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-theme='dark'>
        <InkWagmiProvider>{children}</InkWagmiProvider>
      </body>
    </html>
  )
}
