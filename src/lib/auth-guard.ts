// Offline mode — no auth guard needed, always returns a dummy user object
export async function requireUser() {
  return { id: 'local-user', email: 'admin@iftchennai.in' }
}
