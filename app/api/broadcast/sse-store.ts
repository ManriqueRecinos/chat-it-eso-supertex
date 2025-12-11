// Shared store for SSE clients
export const clients = new Map<string, Set<ReadableStreamDefaultController>>()
export const messageQueue = new Map<string, string[]>()
