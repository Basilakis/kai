/**
 * Session Management V7 Utilities
 * Core utilities for session state management, ID generation, and discovery
 */

const fs = require('fs');
const path = require('path');

// Session state file path
const SESSION_STATE_FILE = '.ruru/state/session_state.json';

/**
 * Generate a unique session ID
 * Format: SESSION-[SanitizedGoal]-[YYMMDDHHMM]
 * @param {string} goal - User's session goal (optional)
 * @returns {string} Generated session ID
 */
function generateSessionID(goal = '') {
    const now = new Date();
    const timestamp = [
        String(now.getFullYear()).slice(-2),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('');
    
    // Sanitize goal for filesystem safety
    const sanitizedGoal = goal
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special chars
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .slice(0, 30) // Limit length
        .toLowerCase();
    
    const goalPart = sanitizedGoal ? `-${sanitizedGoal}` : '';
    return `SESSION${goalPart}-${timestamp}`;
}

/**
 * Read current session state
 * @returns {Object} Session state object
 */
function readSessionState() {
    try {
        if (fs.existsSync(SESSION_STATE_FILE)) {
            const data = fs.readFileSync(SESSION_STATE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading session state:', error);
    }
    
    // Return default state if file doesn't exist or error occurred
    return {
        active_session_id: null,
        session_history: [],
        last_updated: null,
        version: "1.0"
    };
}

/**
 * Write session state to file
 * @param {Object} state - Session state object to write
 */
function writeSessionState(state) {
    try {
        state.last_updated = new Date().toISOString();
        fs.writeFileSync(SESSION_STATE_FILE, JSON.stringify(state, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing session state:', error);
        return false;
    }
}

/**
 * Set active session ID
 * @param {string} sessionId - Session ID to set as active
 */
function setActiveSession(sessionId) {
    const state = readSessionState();
    state.active_session_id = sessionId;
    
    // Add to history if not already present
    if (!state.session_history.includes(sessionId)) {
        state.session_history.unshift(sessionId);
        // Keep only last 20 sessions in history
        state.session_history = state.session_history.slice(0, 20);
    }
    
    return writeSessionState(state);
}

/**
 * Clear active session
 */
function clearActiveSession() {
    const state = readSessionState();
    state.active_session_id = null;
    return writeSessionState(state);
}

/**
 * Get active session ID
 * @returns {string|null} Active session ID or null
 */
function getActiveSession() {
    const state = readSessionState();
    return state.active_session_id;
}

/**
 * Get session history
 * @returns {Array} Array of session IDs in chronological order (newest first)
 */
function getSessionHistory() {
    const state = readSessionState();
    return state.session_history || [];
}

/**
 * Check if a session directory exists
 * @param {string} sessionId - Session ID to check
 * @returns {boolean} True if session directory exists
 */
function sessionExists(sessionId) {
    const sessionPath = `.ruru/sessions/${sessionId}`;
    return fs.existsSync(sessionPath) && fs.statSync(sessionPath).isDirectory();
}

/**
 * Get session log path for a given session ID
 * @param {string} sessionId - Session ID
 * @returns {string} Path to session log file
 */
function getSessionLogPath(sessionId) {
    return `.ruru/sessions/${sessionId}/session_log.md`;
}

/**
 * Discover existing sessions by scanning the sessions directory
 * @returns {Array} Array of discovered session IDs
 */
function discoverExistingSessions() {
    const sessionsDir = '.ruru/sessions';
    const discovered = [];
    
    try {
        if (fs.existsSync(sessionsDir)) {
            const entries = fs.readdirSync(sessionsDir);
            for (const entry of entries) {
                const fullPath = path.join(sessionsDir, entry);
                if (fs.statSync(fullPath).isDirectory() && entry.startsWith('SESSION-')) {
                    // Verify it has a session log
                    const logPath = path.join(fullPath, 'session_log.md');
                    if (fs.existsSync(logPath)) {
                        discovered.push(entry);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error discovering sessions:', error);
    }
    
    return discovered.sort().reverse(); // Newest first based on timestamp in name
}

/**
 * Sync session state with discovered sessions
 * Updates the session history with any sessions found on disk
 */
function syncSessionState() {
    const discovered = discoverExistingSessions();
    const state = readSessionState();
    
    // Merge discovered sessions with existing history
    const allSessions = [...new Set([...discovered, ...state.session_history])];
    state.session_history = allSessions.slice(0, 20); // Keep last 20
    
    // Verify active session still exists
    if (state.active_session_id && !sessionExists(state.active_session_id)) {
        state.active_session_id = null;
    }
    
    writeSessionState(state);
    return state;
}

module.exports = {
    generateSessionID,
    readSessionState,
    writeSessionState,
    setActiveSession,
    clearActiveSession,
    getActiveSession,
    getSessionHistory,
    sessionExists,
    getSessionLogPath,
    discoverExistingSessions,
    syncSessionState
};