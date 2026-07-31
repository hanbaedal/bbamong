const ADMIN_PUBLIC_PATHS = new Set(["/admin/login", "/admin/signup", "/admin/waiting"]);

export function isAdminPublicPath(pathname = window.location.pathname): boolean {
  return ADMIN_PUBLIC_PATHS.has(pathname);
}
