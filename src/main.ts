import './index.css'
import { startGravityDefiedApp } from './app.ts'

const root = document.getElementById('root')

if (!(root instanceof HTMLDivElement)) {
  throw new Error('Missing #root container')
}

startGravityDefiedApp(root).catch((error: unknown) => {
  const pre = document.createElement('pre')
  pre.className = 'error-view'
  pre.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  root.replaceChildren(pre)
})
