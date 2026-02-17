/**
 * Movement actions - re-exports all movement functions for backward compatibility.
 * 
 * Internal structure:
 * - crud.ts: CRUD operations (get, create, update, cancel, queries)
 * - workflow.ts: Workflow operations (submit, approve, post, reject, reverse, return)
 * - batch.ts: Batch operations (batchApprove, batchReject, batchPost, batchCancel)
 * - shared.ts: Shared types, constants, and utilities
 */

// CRUD operations
export {
  getMovements,
  getMovement,
  createMovement,
  updateMovement,
  cancelMovement,
  getLinkedMovements,
  getMovementsByVariant,
  getIssuedMovements,
  getIssuedMovementForReturn,
} from './crud'

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
