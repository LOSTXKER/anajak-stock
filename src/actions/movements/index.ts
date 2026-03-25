/**
 * Movement actions - re-exports all movement functions.
 * 
 * Internal structure:
 * - queries.ts: Read/query operations (getMovements, getMovement, etc.)
 * - create.ts: Creation operations (createMovement)
 * - update.ts: Mutation operations (updateMovement, cancelMovement)
 * - workflow.ts: Workflow operations (submit, approve, post, reject, reverse, return)
 * - batch.ts: Batch operations (batchApprove, batchReject, batchPost, batchCancel)
 * - shared.ts: Shared types, constants, and utilities
 */

// Query operations
export {
  getMovements,
  getMovement,
  getLinkedMovements,
  getMovementsByVariant,
  getIssuedMovements,
  getIssuedMovementForReturn,
} from './queries'

// Create operations
export { createMovement } from './create'

// Update operations
export { updateMovement, cancelMovement } from './update'

// Workflow operations
export {
  submitMovement,
  approveMovement,
  postMovement,
  rejectMovement,
  reverseMovement,
  createReturnFromIssue,
} from './workflow'

// Batch operations
export {
  batchApproveMovements,
  batchRejectMovements,
  batchPostMovements,
  batchCancelMovements,
} from './batch'

// Re-export types
export type {
  MovementLineInput,
  CreateMovementInput,
  UpdateMovementInput,
  UpdateMovementLineInput,
  ReturnLineInput,
} from './shared'
