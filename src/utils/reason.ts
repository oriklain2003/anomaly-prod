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
 * Get the anomaly reason from a report following priority:
 * 1. Tagged rule_id (human-verified, from user_feedback table) - HIGHEST PRIORITY
 * 2. Tagged rule_name (from user_feedback)
 * 3. Matched rules from full_report (automated detection)
 * 4. Matched rule IDs from anomaly_reports
 * 5. Truncated comments
 * 6. "N/A" if nothing available
 * 
 * Human-tagged values take precedence over automated detection.
 */
export function getAnomalyReason(report: AnomalyReport): string {
  // 1. Check for tagged rule_id (direct from user_feedback table) - HIGHEST PRIORITY
  // Human-tagged values should override automated detection
  if (report.rule_id && TAGGING_RULES[report.rule_id]) {
    return TAGGING_RULES[report.rule_id];
  }

  // 2. Check for tagged rule_name (from user_feedback)
  if (report.rule_name) {
    return normalizeRuleName(report.rule_name);
  }

  // 3. Check for matched rules in full_report (automated detection)
  const matchedRules = report.full_report?.layer_1_rules?.report?.matched_rules;
  if (matchedRules && matchedRules.length > 0) {
    const rule = matchedRules[0];
    // Use rule.id -> TAGGING_RULES lookup
    if (rule.id && TAGGING_RULES[rule.id]) {
      return TAGGING_RULES[rule.id];
    }
    // Fallback to rule.name if id lookup fails
    if (rule.name) {
      return normalizeRuleName(rule.name);
    }
  }

  // 4. Check for matched_rule_ids (denormalized in anomaly_reports)
  if (report.matched_rule_ids) {
    const ids = typeof report.matched_rule_ids === 'string' 
      ? report.matched_rule_ids.split(',').map(id => parseInt(id.trim(), 10))
      : report.matched_rule_ids;
    
    if (Array.isArray(ids) && ids.length > 0) {
      const firstId = ids[0];
      if (!isNaN(firstId) && TAGGING_RULES[firstId]) {
        return TAGGING_RULES[firstId];
      }
    }
  }

  // 5. Check for feedback_rule_names
  if (report.feedback_rule_names && report.feedback_rule_names.length > 0) {
    return normalizeRuleName(report.feedback_rule_names[0]);
  }

  // 6. Check for comments (only if they describe a rule/reason)
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

  // 7. Check comments field directly (from API)
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
