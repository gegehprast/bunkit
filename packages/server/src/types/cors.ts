import type { HttpMethod } from "../http/types/route.js"

/**
 * CORS configuration options
 */
export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: HttpMethod[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}
