import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Plane, User, Clock, AlertTriangle, CheckCircle, ChevronDown, Upload, Send, Shield, Flag } from 'lucide-react';
import clsx from 'clsx';
import type { SelectedFlight } from '../types';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  flight: SelectedFlight;
  isAnomaly: boolean;
  anomalyReason: string;
}

// Dropdown categories for classification
const INCIDENT_CATEGORIES = [
  { value: 'false_positive_system', label: 'System False Positive' },
  { value: 'false_positive_weather', label: 'Weather-Related Event' },
  { value: 'false_positive_atc', label: 'ATC Instruction' },
  { value: 'false_positive_training', label: 'Training/Exercise' },
  { value: 'expected_behavior', label: 'Expected Flight Behavior' },
  { value: 'data_quality', label: 'Data Quality Issue' },
  { value: 'sensor_error', label: 'Sensor/Equipment Error' },
  { value: 'other', label: 'Other' },
];

const CONFIDENCE_LEVELS = [
  { value: 'very_high', label: 'Very High', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/50' },
  { value: 'high', label: 'High', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/50' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/50' },
  { value: 'low', label: 'Low', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/50' },
  { value: 'uncertain', label: 'Uncertain', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/50' },
];

const DEPARTMENTS = [
  'Air Traffic Control',
  'Flight Operations',
  'Safety & Compliance',
  'Technical Operations',
  'Quality Assurance',
  'Other',
];

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20' },
  { value: 'high', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  { value: 'low', label: 'Low', color: 'text-green-400', bg: 'bg-green-500/20' },
];

export function IncidentReportModal({ isOpen, onClose, flight, isAnomaly, anomalyReason }: IncidentReportModalProps) {
  const [formData, setFormData] = useState({
    // Reporter Info
    reporterName: '',
    department: '',
    contactEmail: '',
    reporterRole: '',
    
    // Classification
    incidentCategory: '',
    confidenceLevel: 'medium',
    severityLevel: 'medium',
    
    // Description
    observedBehavior: '',
    explanation: '',
    additionalComments: '',
    
    // Action
    recommendedAction: '',
    followUpRequired: false,
    notifyTeam: false,
    priorityFlag: false,
  });
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleSubmit = () => {
    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    if (!formData.reporterName.trim()) newErrors.reporterName = true;
    if (!formData.incidentCategory) newErrors.incidentCategory = true;
    if (!formData.explanation.trim()) newErrors.explanation = true;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Show success state (does nothing per requirement)
    setIsSubmitted(true);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Success state - same style as replay modal
  if (isSubmitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
        <div className="bg-bg-panel w-[calc(100vw-64px)] h-[calc(100vh-64px)] rounded-xl overflow-hidden flex flex-col border border-white/10 shadow-2xl relative">
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 z-[10000] bg-red-600/90 hover:bg-red-500 text-white p-2.5 rounded-full transition-colors shadow-lg border border-red-500/50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Success content */}
          <div className="flex-1 flex items-center justify-center relative">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-cyan-500/10 rounded-full blur-3xl animate-pulse" />
            </div>
            
            <div className="relative text-center px-8 animate-in fade-in zoom-in duration-500">
              <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/10 flex items-center justify-center border-2 border-green-500/50 shadow-[0_0_60px_rgba(34,197,94,0.4)]">
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">Report Submitted Successfully</h2>
              <p className="text-xl text-gray-400 mb-2">
                Incident Report ID: <span className="font-mono text-cyan-400">IR-{Date.now().toString(36).toUpperCase()}</span>
              </p>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Your feedback for flight <span className="font-mono text-white">{flight.callsign || flight.flight_id.slice(0, 8)}</span> has been recorded and will be reviewed by the operations team.
              </p>
              <button
                onClick={onClose}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-lg font-medium rounded-xl border border-white/20 transition-all hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
      <div className="bg-bg-panel w-[calc(100vw-64px)] h-[calc(100vh-64px)] rounded-xl overflow-hidden flex flex-col border border-white/10 shadow-2xl relative">
        
        {/* Close button - absolute positioned */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 z-[10000] bg-red-600/90 hover:bg-red-500 text-white p-2.5 rounded-full transition-colors shadow-lg border border-red-500/50"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/5 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/30 to-orange-500/20 flex items-center justify-center border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <Flag className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                {isAnomaly ? 'Report False Positive' : 'Report Anomaly'}
                <span className="px-3 py-1 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                  INCIDENT REPORT
                </span>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Submit detailed feedback for review by the operations team
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              
              {/* Left Column - Flight Info */}
              <div className="lg:col-span-1 space-y-6">
                {/* Flight Card */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Plane className="w-4 h-4 text-cyan-400" />
                      Flight Information
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Callsign</span>
                      <span className="font-mono text-xl font-bold text-white">
                        {flight.callsign || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Flight ID</span>
                      <span className="font-mono text-xs text-gray-400">
                        {flight.flight_id.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/5">
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span className="font-bold text-white">{flight.origin || '---'}</span>
                        <div className="flex items-center gap-2 text-gray-500">
                          <div className="w-8 h-px bg-gradient-to-r from-cyan-500 to-transparent" />
                          <Plane className="w-4 h-4 text-cyan-400" />
                          <div className="w-8 h-px bg-gradient-to-l from-cyan-500 to-transparent" />
                        </div>
                        <span className="font-bold text-white">{flight.destination || '---'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Aircraft Type</span>
                      <span className="text-gray-300">{flight.report?.aircraft_type || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {flight.report?.timestamp 
                        ? formatTimestamp(flight.report.timestamp) 
                        : 'Timestamp unavailable'}
                    </div>
                  </div>
                </div>

                {/* Current Status Card */}
                <div className={clsx(
                  "rounded-xl border overflow-hidden",
                  isAnomaly 
                    ? "bg-red-500/10 border-red-500/30" 
                    : "bg-green-500/10 border-green-500/30"
                )}>
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      {isAnomaly ? (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      <span className={clsx(
                        "font-semibold",
                        isAnomaly ? "text-red-400" : "text-green-400"
                      )}>
                        {isAnomaly ? 'Flagged as Anomaly' : 'Normal Status'}
                      </span>
                    </div>
                    {isAnomaly && anomalyReason && anomalyReason !== 'N/A' && (
                      <div className="p-3 rounded-lg bg-black/30 border border-red-500/20">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Detection Reason</p>
                        <p className="text-sm text-red-300">{anomalyReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    Quick Options
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <button
                        onClick={() => handleInputChange('priorityFlag', !formData.priorityFlag)}
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          formData.priorityFlag
                            ? "bg-red-500/30 border-red-500 text-red-400"
                            : "bg-black/20 border-white/20 group-hover:border-white/40"
                        )}
                      >
                        {formData.priorityFlag && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-300 group-hover:text-white">Mark as high priority</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <button
                        onClick={() => handleInputChange('followUpRequired', !formData.followUpRequired)}
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          formData.followUpRequired
                            ? "bg-cyan-500/30 border-cyan-500 text-cyan-400"
                            : "bg-black/20 border-white/20 group-hover:border-white/40"
                        )}
                      >
                        {formData.followUpRequired && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-300 group-hover:text-white">Request follow-up investigation</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <button
                        onClick={() => handleInputChange('notifyTeam', !formData.notifyTeam)}
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          formData.notifyTeam
                            ? "bg-purple-500/30 border-purple-500 text-purple-400"
                            : "bg-black/20 border-white/20 group-hover:border-white/40"
                        )}
                      >
                        {formData.notifyTeam && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-300 group-hover:text-white">Notify safety team</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column - Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Reporter Information */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      Reporter Information
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">
                          Full Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.reporterName}
                          onChange={(e) => handleInputChange('reporterName', e.target.value)}
                          placeholder="Enter your name"
                          className={clsx(
                            "w-full px-4 py-3 bg-black/40 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all",
                            errors.reporterName 
                              ? "border-red-500/50 focus:ring-red-500/30" 
                              : "border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Role / Position</label>
                        <input
                          type="text"
                          value={formData.reporterRole}
                          onChange={(e) => handleInputChange('reporterRole', e.target.value)}
                          placeholder="e.g., Senior Controller"
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Department</label>
                        <div className="relative">
                          <select
                            value={formData.department}
                            onChange={(e) => handleInputChange('department', e.target.value)}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-gray-900">Select department</option>
                            {DEPARTMENTS.map(dept => (
                              <option key={dept} value={dept} className="bg-gray-900">{dept}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Contact Email</label>
                        <input
                          type="email"
                          value={formData.contactEmail}
                          onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                          placeholder="email@example.com"
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Incident Classification */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      Incident Classification
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">
                          Category <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={formData.incidentCategory}
                            onChange={(e) => handleInputChange('incidentCategory', e.target.value)}
                            className={clsx(
                              "w-full px-4 py-3 bg-black/40 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 appearance-none cursor-pointer",
                              errors.incidentCategory 
                                ? "border-red-500/50 focus:ring-red-500/30" 
                                : "border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                            )}
                          >
                            <option value="" className="bg-gray-900">Select category</option>
                            {INCIDENT_CATEGORIES.map(cat => (
                              <option key={cat.value} value={cat.value} className="bg-gray-900">{cat.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Severity Level</label>
                        <div className="flex items-center gap-2">
                          {SEVERITY_LEVELS.map(level => (
                            <button
                              key={level.value}
                              onClick={() => handleInputChange('severityLevel', level.value)}
                              className={clsx(
                                "flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                                formData.severityLevel === level.value
                                  ? `${level.bg} ${level.color} border-current shadow-lg`
                                  : "bg-black/20 text-gray-500 border-white/5 hover:border-white/20"
                              )}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Confidence in Assessment</label>
                      <div className="flex items-center gap-2">
                        {CONFIDENCE_LEVELS.map(level => (
                          <button
                            key={level.value}
                            onClick={() => handleInputChange('confidenceLevel', level.value)}
                            className={clsx(
                              "flex-1 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all",
                              formData.confidenceLevel === level.value
                                ? `${level.bg} ${level.color} shadow-lg`
                                : "bg-black/20 text-gray-500 border-white/5 hover:border-white/20"
                            )}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Description */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Detailed Description
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Observed Flight Behavior</label>
                      <textarea
                        value={formData.observedBehavior}
                        onChange={(e) => handleInputChange('observedBehavior', e.target.value)}
                        placeholder="Describe the flight behavior you observed in detail..."
                        rows={3}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">
                        {isAnomaly ? 'Explanation: Why is this NOT an anomaly?' : 'Explanation: Why IS this an anomaly?'} <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={formData.explanation}
                        onChange={(e) => handleInputChange('explanation', e.target.value)}
                        placeholder={isAnomaly 
                          ? "Provide a detailed explanation of why you believe this detection is a false positive..." 
                          : "Provide a detailed explanation of why you believe this flight should be flagged as anomalous..."}
                        rows={4}
                        className={clsx(
                          "w-full px-4 py-3 bg-black/40 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none",
                          errors.explanation 
                            ? "border-red-500/50 focus:ring-red-500/30" 
                            : "border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Recommended Action</label>
                        <input
                          type="text"
                          value={formData.recommendedAction}
                          onChange={(e) => handleInputChange('recommendedAction', e.target.value)}
                          placeholder="e.g., Update detection rules"
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Additional Comments</label>
                        <input
                          type="text"
                          value={formData.additionalComments}
                          onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                          placeholder="Any other relevant information..."
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-5 py-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      Attachments
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/30 transition-all cursor-pointer group bg-black/20">
                      <Upload className="w-10 h-10 mx-auto text-gray-600 group-hover:text-gray-400 mb-3 transition-colors" />
                      <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                        Drop files here or click to upload
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        Screenshots, logs, radar data, or any supporting documents
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="shrink-0 border-t border-white/10 bg-bg-panel px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <p className="text-xs text-gray-500">
              <span className="text-red-400">*</span> Required fields • Report will be reviewed within 24 hours
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="px-6 py-3 text-sm text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-cyan-500/30 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Incident Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
