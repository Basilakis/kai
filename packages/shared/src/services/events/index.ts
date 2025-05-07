/**
 * Events Service Index
 * 
 * This file exports all events-related functionality.
 */

// Export event bus
export { 
  eventBus, 
  EventHandler, 
  EventBusOptions 
} from './eventBus';

// Export default for convenience
export { eventBus as default } from './eventBus';
