
export interface RoomMaterials {
  room_identification: string;
  materials: {
    flooring_system: {
      material_category: string;
      grade_estimation: string;
    };
    wall_system: {
      substrate_material: string;
      finish_type: string;
    };
    trim_and_millwork: {
      baseboard_material: string;
      height_inches: number;
    };
  };
}

export interface Reading {
  timestamp: number;
  temp: number; // Fahrenheit
  rh: number; // Relative Humidity %
  gpp: number; // Grains Per Pound (Calculated)
  mc: number; // Moisture Content % (Material)
}

export interface PsychrometricsData {
  dryBulb: number; // Fahrenheit
  relativeHumidity: number; // %
  pressure?: number; // inHg
  dewPoint: number; // Fahrenheit
  gpp: number; // Grains Per Pound
  vaporPressure: number; // inHg
  enthalpy?: number; // BTU/lb
}

export enum WaterCategory {
  CAT_1 = 'Category 1 (Clean)',
  CAT_2 = 'Category 2 (Gray)',
  CAT_3 = 'Category 3 (Black)'
}

export enum LossClass {
  CLASS_1 = 'Class 1 (Least)',
  CLASS_2 = 'Class 2 (Significant)',
  CLASS_3 = 'Class 3 (Greatest)',
  CLASS_4 = 'Class 4 (Specialty)'
}

export interface SafetyAssessment {
  electricalSafe: boolean;
  structuralSafe: boolean;
  biohazardRisk: boolean;
  ppeRequired: string[];
  notes: string;
  completedAt: number;
}

export interface Milestone {
  title: string;
  date: string;
  status: 'completed' | 'active' | 'pending';
}

export interface SubTask {
    id: string;
    text: string;
    isCompleted: boolean;
}

export interface AITask {
    id: string;
    text: string;
    isCompleted: boolean;
    subtasks?: SubTask[];
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
}

export interface LineItem {
    id:string;
    code?: string; // e.g. WTR [BASEA]
    description: string;
    quantity: number;
    rate: number;
    total: number;
    category?: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  timestamp: number;
  tags: string[];
  notes: string;
  aiInsight?: string;
  type?: 'image' | 'video';
  meterReading?: string;
  materialLabel?: string;
}

export interface VideoLog {
  id: string;
  url: string;
  thumbnail?: string;
  timestamp: number;
  description: string;
}

export interface PlacedPhoto extends Photo {
  position: {
    wall: 'floor' | 'ceiling' | 'front' | 'back' | 'left' | 'right';
    x: number; // percentage from left (0-100)
    y: number; // percentage from bottom (0-100)
  };
}

export interface RoomScan {
  scanId: string;
  roomName: string;
  floorPlanSvg: string;
  dimensions: { length: number; width: number; height: number; sqft: number };
  placedPhotos: PlacedPhoto[];
  materials?: RoomMaterials;
}

export interface Room {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  readings: Reading[];
  photos: Photo[];
  status: 'wet' | 'drying' | 'dry';
}

export interface PlacedEquipment {
  id: string;
  type: 'Air Mover' | 'Dehumidifier' | 'HEPA Scrubber' | 'Heater';
  model: string;
  status: 'Running' | 'Off' | 'Removed';
  hours: number;
  room: string;
}

export interface ComplianceCheck {
    id: string;
    text: string;
    isCompleted: boolean;
}

export interface DailyNarrative {
  id: string;
  date: string;
  timestamp: number;
  content: string;
  author: string;
  tags: string[]; // e.g., 'Equipment', 'Monitoring', 'Communication'
  generated: boolean;
  attachments?: string[]; // IDs of photos linked to this log
  // Rich Feed additions
  entryType?: 'general' | 'drying' | 'photo' | 'equipment' | 'compliance' | 'voice';
  data?: unknown; 
}

// --- NEW TYPES FOR MATERIAL TRACKING (MOISTURE MATRIX) ---
export interface MaterialReading {
    timestamp: number;
    value: number; // Moisture Content % or Points
    dateStr: string; // e.g. "Oct 12"
}

export interface TrackedMaterial {
    id: string;
    name: string; // e.g. "Drywall"
    location: string; // e.g. "North Wall under window"
    type: string;
    dryGoal: number; // The target dry standard (e.g. 10%)
    initialReading: number; // The baseline wet reading (e.g. 99%)
    readings: MaterialReading[]; // History of readings
    status: 'Wet' | 'Dry' | 'Removed';
}
// ---------------------------------------------------------

export type ProjectStage = 'Intake' | 'Inspection' | 'Scope' | 'Stabilize' | 'Monitor' | 'Closeout';

// Renamed from Project to LossFile to match "Mitigate" terminology
export interface ARMarker {
  id: string;
  x: number; // percentage on site plan
  y: number; // percentage on site plan
  label: string;
  type: 'equipment' | 'damage' | 'moisture' | 'note';
  value?: string;
  equipmentType?: string;
  equipmentStatus?: 'Running' | 'Off';
  timestamp: number;
  tags?: string[];
  color?: string;
}

export interface ARArea {
  id: string;
  points: { x: number; y: number }[]; // percentage coordinates
  label: string;
  type: 'affected' | 'mitigated' | 'safe' | 'containment';
  color: string;
  timestamp: number;
  tags?: string[];
}

export interface ARMappingData {
  sitePlanUrl?: string;
  markers: ARMarker[];
  areas?: ARArea[];
  scale?: number; // pixels per foot
}

export interface Project {
  id: string;
  arMapping?: ARMappingData;
  companyId: string;
  client: string; // Client Display Name
  clientEmail?: string;
  clientPhone?: string;
  address: string;
  
  status: string; // General status text
  currentStage: ProjectStage; // Workflow Step
  progress: number;
  
  // Dates
  lossDate?: string;
  startDate?: string;
  estimate?: string;

  // Insurance
  insurance?: string;
  policyNumber?: string;
  adjuster?: string;
  adjusterEmail?: string;
  adjusterPhone?: string;
  claimNumber?: string; // Added claim number
  
  summary?: string;
  logs?: string;
  dailyNarratives?: DailyNarrative[]; 
  dryingMonitor?: TrackedMaterial[]; // New field for specific material tracking
  riskLevel: 'low' | 'medium' | 'high';
  rooms: Room[];
  
  waterCategory?: WaterCategory;
  lossClass?: LossClass;
  
  milestones: Milestone[];
  tasks: AITask[];
  lineItems: LineItem[];
  totalCost: number;
  invoiceStatus: 'Draft' | 'Sent' | 'Paid';
  roomScans: RoomScan[];
  videos: VideoLog[];
  
  complianceChecks?: {
      asbestos: 'not_tested' | 'pending' | 'clear' | 'abatement_required';
      aiChecklist: ComplianceCheck[];
  }
  budget?: number;
  assignedTeam?: string[];
  equipment?: PlacedEquipment[];
  ticSheet?: unknown[];
  iicrcReport?: string;
  xactimateReport?: string;
}

export type LossFile = Project;

export interface AIProjectData extends Project {
  aiSummary: string;
  aiAlert: {
    isAlert: boolean;
    reason: string;
  };
  priority: number;
}

export interface AppSettings {
  language: string;
  dateFormat: string;
  timeFormat: string;
  units: {
    temperature: 'Fahrenheit' | 'Celsius';
    dimension: 'LF Inch' | 'Meters';
    humidity: 'Grains / Pound' | 'g/kg';
    volume: 'Pint' | 'Liter';
  };
  copyPhotosToGallery: boolean;
  defaultView: 'Timeline' | 'List';
}

export interface DownloadItem {
    id: string;
    label: string;
    description: string;
    checked: boolean;
}

export type Permission = 'manage_users' | 'view_billing' | 'manage_billing' | 'view_projects' | 'edit_projects' | 'view_admin' | 'use_ai_tools' | 'manage_company';

export type UserRole = 'SuperAdmin' | 'CompanyAdmin' | 'Technician';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    companyId: string;
    permissions: Permission[];
}

export interface Company {
    id: string;
    name: string;
    subscriptionPlan: 'Basic' | 'Pro' | 'Enterprise';
    maxUsers: number;
    isActive: boolean;
}

export type Tab = 
    | 'dashboard' 
    | 'losses' 
    | 'downloads' 
    | 'alerts' 
    | 'more' 
    | 'new-loss' 
    | 'new-project' 
    | 'settings' 
    | 'loss-detail' 
    | 'project' 
    | 'line-items' 
    | 'tic-sheet' 
    | 'scanner' 
    | 'equipment'
    | 'photos'
    | 'admin'
    | 'reporting'
    | 'billing'
    | 'smart-docs'; // Added smart-docs tab
