/** Runs once when a server instance starts. The Node-only work lives in its own module so the Edge bundle never sees it. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { onServerStart } = await import('./instrumentation-node')
    onServerStart()
  }
}
