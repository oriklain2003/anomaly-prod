import type { AnomalyReport } from '../types';

/**
 * Standard rule IDs - matches web2 UI tagging rules (source of truth)
 * These are the rules available for human tagging in the feedback system
 */
const TAGGING_RULES: Record<number, string> = {
  // Emergency & Safety (Red)
  1: 'Emergency Squawks',       // Transponder emergency code (7500, 7600, 7700)
  2: 'Crash',                   // Aircraft crash or suspected crash event
  3: 'Proximity Alert',         // Dangerous proximity between aircraft
  
  // Flight Operations (Blue)
  4: 'Holding Pattern',         // Aircraft in holding pattern
  5: 'Go Around',               // Aborted landing and go-around maneuver
  6: 'Return to Land',          // Aircraft returning to departure airport
  7: 'Unplanned Landing',       // Landing at unplanned airport
  
  // Technical (Purple)
  8: 'Signal Loss',             // Loss of ADS-B signal
  9: 'Off Course',              // Significant deviation from expected flight path
  14: 'GPS Jamming',            // GPS jamming indicators detected
  
  // Military (Green)
  10: 'Military Flight',        // Identified military aircraft
  11: 'Operational Military',   // Military aircraft on operational mission
  12: 'Suspicious Behavior',    // Unusual or suspicious flight behavior
  13: 'Flight Academy',         // Training flight from flight school
};

/**
 * Map various rule name formats to standard display names
 * Matches web2 UI naming conventions
 */
const RULE_NAME_MAP: Record<string, string> = {
  // Emergency & Safety
  'emergency_squawks': 'Emergency Squawks',
  'emergency squawks': 'Emergency Squawks',
  'emergency_squawk': 'Emergency Squawks',
  'crash': 'Crash',
  'proximity_alert': 'Proximity Alert',
  'proximity alert': 'Proximity Alert',
  'dangerous_proximity': 'Proximity Alert',
  
  // Flight Operations
  'holding_pattern': 'Holding Pattern',
  'holding pattern': 'Holding Pattern',
  'abrupt_turn': 'Holding Pattern',  // Map old "abrupt turn" to new "holding pattern"
  'abrupt turn': 'Holding Pattern',
  'go_around': 'Go Around',
  'go around': 'Go Around',
  'go-around': 'Go Around',
  'return_to_land': 'Return to Land',
  'return to land': 'Return to Land',
  'return_to_field': 'Return to Land',
  'return to field': 'Return to Land',
  'unplanned_landing': 'Unplanned Landing',
  'unplanned landing': 'Unplanned Landing',
  'diversion': 'Unplanned Landing',
  
  // Technical
  'signal_loss': 'Signal Loss',
  'signal loss': 'Signal Loss',
  'off_course': 'Off Course',
  'off course': 'Off Course',
  'gps_jamming': 'GPS Jamming',
  'gps jamming': 'GPS Jamming',
  'altitude_deviation': 'Off Course',
  'altitude deviation': 'Off Course',
  'path_deviation': 'Off Course',
  'path deviation': 'Off Course',
  
  // Military
  'military_flight': 'Military Flight',
  'military flight': 'Military Flight',
  'military_aircraft': 'Military Flight',
  'military aircraft': 'Military Flight',
  'operational_military': 'Operational Military',
  'operational_military_flight': 'Operational Military',
  'suspicious_behavior': 'Suspicious Behavior',
  'suspicious behavior': 'Suspicious Behavior',
  'flight_academy': 'Flight Academy',
  'flight academy': 'Flight Academy',
};

/**
 * Normalize a rule name to a standard display format
 */
function normalizeRuleName(name: string): string {
  if (!name) return '';
  
  const lowerName = name.toLowerCase().trim();
  
  // Check direct mapping
  if (RULE_NAME_MAP[lowerName]) {
    return RULE_NAME_MAP[lowerName];
  }
  
  // Check if it contains known rule patterns
  for (const [pattern, displayName] of Object.entries(RULE_NAME_MAP)) {
    if (lowerName.includes(pattern)) {
      return displayName;
    }
  }
  
  // Title case the original if no mapping found
  return name.split(/[_\s]+/).map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Helper to parse a rule ID from various formats (number, string, null)
 * Returns the numeric ID or null if invalid
 */
function parseRuleId(id: unknown): number | null {
  if (id === null || id === undefined) return null;
  if (typeof id === 'number') {
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  if (typeof id === 'string') {
    const parsed = parseInt(id.trim(), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * Helper to add a reason to the Set, avoiding duplicates
 */
function addReasonFromId(id: unknown, reasonsSet: Set<string>): boolean {
  const parsedId = parseRuleId(id);
  if (parsedId !== null && TAGGING_RULES[parsedId]) {
    reasonsSet.add(TAGGING_RULES[parsedId]);
    return true;
  }
  return false;
}

/**
 * Get ALL anomaly reasons from a report as an array.
 * Priority order (combines all available sources, deduplicates):
 * 1. rule_ids array (primary - human tagged, multiple rules)
 * 2. rule_id (secondary - human tagged, single rule, added if not already present)
 * 3. rule_name (human tagged name)
 * 4. matched_rules from full_report (automated detection)
 * 5. matched_rule_ids (denormalized from anomaly_reports)
 * 6. feedback_rule_names (legacy feedback)
 */
export function getAnomalyReasons(report: AnomalyReport): string[] {
  const reasonsSet = new Set<string>();
  
  // 1. FIRST: Check rule_ids array (multiple rules tagged - highest priority)
  if (report.rule_ids && Array.isArray(report.rule_ids)) {
    for (const id of report.rule_ids) {
      addReasonFromId(id, reasonsSet);
    }
  }
  
  // 2. THEN: Also check rule_id (single rule - add if not already present from rule_ids)
  // This ensures we don't miss a rule_id even if rule_ids exists but doesn't include it
  if (report.rule_id !== undefined && report.rule_id !== null) {
    addReasonFromId(report.rule_id, reasonsSet);
  }
  
  // If we have any tagged rules from rule_ids or rule_id, return them
  if (reasonsSet.size > 0) {
    return Array.from(reasonsSet);
  }

  // 3. Check for tagged rule_name (from user_feedback - string name)
  if (report.rule_name && typeof report.rule_name === 'string' && report.rule_name.trim()) {
    const normalized = normalizeRuleName(report.rule_name);
    if (normalized) {
      return [normalized];
    }
  }

  // 4. Check for matched rules in full_report (automated detection)
  const matchedRules = report.full_report?.layer_1_rules?.report?.matched_rules;
  if (matchedRules && Array.isArray(matchedRules) && matchedRules.length > 0) {
    for (const rule of matchedRules) {
      if (rule && typeof rule === 'object') {
        // Try ID first, then name
        if (!addReasonFromId(rule.id, reasonsSet) && rule.name) {
          const normalized = normalizeRuleName(rule.name);
          if (normalized) {
            reasonsSet.add(normalized);
          }
        }
      }
    }
    if (reasonsSet.size > 0) return Array.from(reasonsSet);
  }

  // 5. Check for matched_rule_ids (denormalized in anomaly_reports)
  if (report.matched_rule_ids) {
    let ids: (string | number)[] = [];
    
    if (typeof report.matched_rule_ids === 'string') {
      // Handle comma-separated string: "3,4,5"
      ids = report.matched_rule_ids.split(',').map(s => s.trim()).filter(s => s);
    } else if (Array.isArray(report.matched_rule_ids)) {
      ids = report.matched_rule_ids;
    }
    
    for (const id of ids) {
      addReasonFromId(id, reasonsSet);
    }
    if (reasonsSet.size > 0) return Array.from(reasonsSet);
  }

  // 6. Check for feedback_rule_names (legacy)
  if (report.feedback_rule_names && Array.isArray(report.feedback_rule_names)) {
    for (const name of report.feedback_rule_names) {
      if (name && typeof name === 'string' && name.trim()) {
        const normalized = normalizeRuleName(name);
        if (normalized) {
          reasonsSet.add(normalized);
        }
      }
    }
    if (reasonsSet.size > 0) return Array.from(reasonsSet);
  }

  return [];
}

/**
 * Get the anomaly reason from a report following priority:
 * 1. Tagged rule_ids (human-verified, multiple rules)
 * 2. Tagged rule_id (human-verified, single rule)
 * 3. Tagged rule_name (from user_feedback)
 * 4. Matched rules from full_report (automated detection)
 * 5. Matched rule IDs from anomaly_reports
 * 6. Truncated comments
 * 7. "N/A" if nothing available
 * 
 * Human-tagged values take precedence over automated detection.
 * Returns concatenated string for multiple rules (e.g. "Proximity + Holding")
 */
export function getAnomalyReason(report: AnomalyReport): string {
  const reasons = getAnomalyReasons(report);
  
  if (reasons.length > 0) {
    // Show up to 2 reasons, abbreviated for space
    if (reasons.length === 1) {
      let formated_reason = reasons[0];
      if (formated_reason.includes('ther')) {
        formated_reason = formated_reason.split(":")[1].trim();
      }
      return formated_reason;
    } else if (reasons.length === 2) {
      // Abbreviate long names for the combined display
      const abbrev = (s: string) => s.length > 12 ? s.slice(0, 10) + '..' : s;
      return `${abbrev(reasons[0])} + ${abbrev(reasons[1])}`;
    } else {
      // More than 2 rules
      const abbrev = (s: string) => s.length > 10 ? s.slice(0, 8) + '..' : s;
      return `${abbrev(reasons[0])} +${reasons.length - 1}`;
    }
  }

  // Fallback: Check for comments (only if they describe a rule/reason)
  if (report.feedback_comments && report.feedback_comments.trim()) {
    const comment = report.feedback_comments.trim();
    // Don't show model-related comments, only rule-based ones
    if (!comment.toLowerCase().includes('model') && 
        !comment.toLowerCase().includes('ml') &&
        !comment.toLowerCase().includes('cnn') &&
        !comment.toLowerCase().includes('transformer')) {
      return truncate(comment, 25);
    }
  }

  // Check comments field directly (from API)
  if (report.comments && report.comments.trim()) {
    const comment = report.comments.trim();
    if (!comment.toLowerCase().includes('model') && 
        !comment.toLowerCase().includes('ml') &&
        !comment.toLowerCase().includes('cnn') &&
        !comment.toLowerCase().includes('transformer')) {
      return truncate(comment, 25);
    }
  }

  return 'N/A';
}

/**
 * Get the anomaly score (0-100) from a report.
 * Uses confidence_score from summary, or calculates from severity values.
 */
export function getAnomalyScore(report: AnomalyReport): number {
  // Use confidence score if available
  const confidenceScore = report.full_report?.summary?.confidence_score;
  if (typeof confidenceScore === 'number') {
    return Math.round(confidenceScore);
  }

  // Fallback: calculate from severity values
  const severityCnn = report.severity_cnn || 0;
  const severityDense = report.severity_dense || 0;
  
  // Take the max of the two severities
  const maxSeverity = Math.max(severityCnn, severityDense);
  
  // Severity is typically 0-1, convert to 0-100
  if (maxSeverity <= 1) {
    return Math.round(maxSeverity * 100);
  }
  
  return Math.round(Math.min(maxSeverity, 100));
}

/**
 * Get a color class based on anomaly score.
 */
export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-red-400';
  if (score >= 70) return 'text-orange-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 20) return 'text-blue-400';
  return 'text-gray-400';
}

/**
 * Get a background color class based on anomaly score.
 */
export function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-red-500';
  if (score >= 70) return 'bg-orange-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 20) return 'bg-blue-500';
  return 'bg-gray-500';
}

/**
 * Format a timestamp to a readable time string.
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a timestamp to a readable date string.
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
