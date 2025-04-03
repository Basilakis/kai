/**
 * Re-export crewai types for consistent usage across the codebase
 */
import type { Agent, Crew, Task, CrewConfig } from 'crewai';

export type { Agent, Crew, Task, CrewConfig };
export { Agent as CrewAgent, Crew as CrewInstance } from 'crewai';