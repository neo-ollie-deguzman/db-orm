/**
 * Thrown when a tenant-scoped entity is not found.
 * Caller (web/api) can map to 404.
 */
export class CoreNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "CoreNotFoundError";
  }
}

/**
 * Thrown when a create/update would violate a unique constraint (e.g. duplicate email).
 * Caller can map to 409 Conflict.
 */
export class CoreConflictError extends Error {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "CoreConflictError";
  }
}
