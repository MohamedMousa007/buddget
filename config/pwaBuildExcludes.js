/**
 * Build assets next-pwa must not precache. The route-handler stub chunks (`static/chunks/app/api/**`) are 670-byte client
 * stubs that serve no purpose offline, and precaching them hands every visitor the full /api and /api/admin route list in sw.js.
 */
module.exports = [/middleware-manifest\.json$/, /chunks\/app\/api\//]
