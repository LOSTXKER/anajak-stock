/**
 * @deprecated Import from '@/actions/movements' or the specific sub-modules
 * (queries, create, update) instead. This file is kept for backward compatibility.
 */
export {
  getMovements,
  getMovement,
  getLinkedMovements,
  getMovementsByVariant,
  getIssuedMovements,
  getIssuedMovementForReturn,
} from './queries'

export { createMovement } from './create'

export { updateMovement, cancelMovement } from './update'
