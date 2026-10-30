export type EducationQualification =
  | 'B.Tech / B.E.'
  | 'MBA / PGDM'
  | 'BCA / MCA'
  | 'Graduate (B.Sc, B.Com, B.A, BBA)'
  | 'Post-Graduate (M.Sc, M.Com, M.A)'
  | 'Diploma / Polytechnic'
  | 'Doctorate / Ph.D.'
  | 'Chartered / Professional (CA, CS, CMA)'
  | 'Medical / Pharmacy'
  | 'Law / Legal'
  | 'Architecture / Design'
  | 'ITI / Trade'
  | '12th / HSC'
  | '10th / SSC'
  | 'Other / Certification'
  | 'Diploma'
  | 'Graduate'
  | 'HSC'
  | 'ITI'
  | 'Post-Graduate'
  | 'SSC';

export const EDUCATION_QUALIFICATIONS: EducationQualification[] = [
  'B.Tech / B.E.',
  'MBA / PGDM',
  'BCA / MCA',
  'Graduate (B.Sc, B.Com, B.A, BBA)',
  'Post-Graduate (M.Sc, M.Com, M.A)',
  'Diploma / Polytechnic',
  'Doctorate / Ph.D.',
  'Chartered / Professional (CA, CS, CMA)',
  'Medical / Pharmacy',
  'Law / Legal',
  'Architecture / Design',
  'ITI / Trade',
  '12th / HSC',
  '10th / SSC',
  'Other / Certification'
];

export const EDUCATION_QUALIFICATION_ICONS: Record<EducationQualification, string> = {
  'B.Tech / B.E.': '',
  'MBA / PGDM': '',
  'BCA / MCA': '',
  'Graduate (B.Sc, B.Com, B.A, BBA)': '',
  'Post-Graduate (M.Sc, M.Com, M.A)': '',
  'Diploma / Polytechnic': '',
  'Doctorate / Ph.D.': '',
  'Chartered / Professional (CA, CS, CMA)': '',
  'Medical / Pharmacy': '',
  'Law / Legal': '',
  'Architecture / Design': '',
  'ITI / Trade': '',
  '12th / HSC': '',
  '10th / SSC': '',
  'Other / Certification': '',
  'Diploma': '',
  'Graduate': '',
  'HSC': '',
  'ITI': '',
  'Post-Graduate': '',
  'SSC': ''
};

export const EDUCATION_SPECIALIZATIONS: Record<EducationQualification, string[]> = {
  'B.Tech / B.E.': [
    'B.Tech / B.E. (General)',
    'B.Tech',
    'B.Tech - Computer Science & Engineering (CSE)',
    'B.Tech - Information Technology (IT)',
    'B.Tech - Artificial Intelligence & Data Science',
    'B.Tech - Mechanical Engineering',
    'B.Tech - Electronics & Telecommunication (E&TC)',
    'B.Tech - Electrical Engineering',
    'B.Tech - Civil Engineering',
    'B.Tech - Chemical Engineering',
    'B.Tech - Automobile Engineering',
    'B.Tech - Production & Industrial Engineering',
    'B.Tech - Instrumentation & Control',
    'B.Tech - Biotechnology',
    'B.Tech - Robotics & Automation',
    'B.Tech - Metallurgy & Materials',
    'B.Tech - Aerospace / Aeronautical',
    'B.Tech - Environmental Engineering',
    'B.Tech - Textile Engineering',
    'B.Tech - Mechatronics Engineering',
    'B.Tech / B.E. - Other Branch'
  ],
  'MBA / PGDM': [
    'MBA (General)',
    'MBA',
    'MBA - Marketing',
    'MBA - Human Resources (HR)',
    'MBA - Finance',
    'MBA - Operations & Supply Chain',
    'MBA - Business Analytics & Big Data',
    'MBA - Information Technology (IT) / Systems',
    'MBA - International Business (IB)',
    'MBA - General Management',
    'MBA - Healthcare & Hospital Management',
    'MBA - Agribusiness Management',
    'MBA - Banking & Financial Services',
    'PGDM - Any Specialization',
    'Executive MBA',
    'MBA / PGDM - Other'
  ],
  'BCA / MCA': [
    'BCA (Bachelor of Computer Applications)',
    'BCA',
    'MCA (Master of Computer Applications)',
    'MCA',
    'BCA - Cloud Computing & DevOps',
    'BCA - Cyber Security & Forensics',
    'BCA - Data Science & AI',
    'BCA - Full Stack Web & Mobile App Dev',
    'MCA - Software Engineering',
    'MCA - AI & Machine Learning',
    'BCA / MCA - Other'
  ],
  'Graduate (B.Sc, B.Com, B.A, BBA)': [
    'Graduate (General)',
    'Graduate',
    'Any Graduate',
    'B.Sc - Computer Science',
    'B.Sc - Information Technology (IT)',
    'B.Sc - Data Science / AI',
    'B.Sc - Mathematics / Statistics',
    'B.Sc - Physics',
    'B.Sc - Chemistry / Analytical Chemistry',
    'B.Sc - Biotechnology / Microbiology',
    'B.Sc - Agriculture / Horticulture',
    'B.Sc - General',
    'B.Com - General',
    'B.Com - Accounting & Finance (BAF)',
    'B.Com - Banking & Insurance (BBI)',
    'B.Com - Financial Markets (BFM)',
    'B.Com - Taxation & Cost Accounting',
    'BBA - Marketing',
    'BBA - Finance',
    'BBA - Human Resources (HR)',
    'BBA - International Business',
    'BMS (Bachelor of Management Studies)',
    'B.A - Economics',
    'B.A - English / Literature',
    'B.A - Psychology / Sociology',
    'B.A - Journalism & Mass Communication',
    'B.Des (Design - Fashion / Graphic / UI-UX)',
    'BHM (Hotel Management & Catering)',
    'B.Ed (Bachelor of Education)',
    'BSW (Bachelor of Social Work)',
    'Graduate - Other'
  ],
  'Post-Graduate (M.Sc, M.Com, M.A)': [
    'Post-Graduate (General)',
    'Post-Graduate',
    'Any Post-Graduate',
    'M.Sc - Computer Science',
    'M.Sc - Information Technology (IT)',
    'M.Sc - Data Science / Analytics',
    'M.Sc - Mathematics / Statistics',
    'M.Sc - Physics',
    'M.Sc - Chemistry / Organic Chemistry',
    'M.Sc - Biotechnology / Microbiology',
    'M.Com - Advanced Accountancy & Finance',
    'M.Com - Business Management & Banking',
    'M.A - Economics',
    'M.A - English Literature',
    'M.A - Psychology / Clinical Psychology',
    'M.A - Mass Communication & Journalism',
    'M.Ed (Master of Education)',
    'MS (Master of Science - US/Global)',
    'Post-Graduate - Other'
  ],
  'Diploma / Polytechnic': [
    'Diploma (General)',
    'Diploma',
    'Diploma in Computer Engineering / IT',
    'Diploma in Mechanical Engineering',
    'Diploma in Electrical Engineering',
    'Diploma in Civil Engineering',
    'Diploma in Electronics & Telecommunication (E&TC)',
    'Diploma in Automobile Engineering',
    'Diploma in Chemical Engineering',
    'Diploma in Production / Industrial Engineering',
    'Diploma in Architecture',
    'Diploma in Tool & Die Making',
    'Diploma in Plastic & Polymer Technology',
    'Diploma in Pharmacy (D.Pharm)',
    'Diploma in Hotel Management & Catering',
    'Diploma in Graphic & Web Designing / UI-UX',
    'Diploma in Digital Marketing',
    'Diploma in Fire & Industrial Safety',
    'Diploma in Export / Import Management',
    'Diploma - Any Stream',
    'Diploma - Other'
  ],
  'Doctorate / Ph.D.': [
    'Ph.D. in Computer Science & Engineering',
    'Ph.D. in Mechanical / Electrical / Civil Engineering',
    'Ph.D. in Management & Business Studies',
    'Ph.D. in Physics / Chemistry / Mathematics',
    'Ph.D. in Biotechnology / Life Sciences',
    'Ph.D. in Economics / Social Sciences',
    'Post-Doctoral Fellow',
    'Doctorate - Other'
  ],
  'Chartered / Professional (CA, CS, CMA)': [
    'Chartered Accountant (CA) - Final Qualified',
    'CA Inter / IPCC',
    'Company Secretary (CS) - Final Qualified',
    'CS Inter',
    'CMA / ICWA - Final Qualified',
    'CMA / ICWA Inter',
    'CFA (Chartered Financial Analyst)',
    'US CPA / ACCA',
    'Professional Finance - Other'
  ],
  'Medical / Pharmacy': [
    'B.Pharm (Bachelor of Pharmacy)',
    'M.Pharm (Master of Pharmacy)',
    'Pharm.D (Doctor of Pharmacy)',
    'MBBS (Bachelor of Medicine, Bachelor of Surgery)',
    'MD / MS',
    'BDS / MDS (Dental Surgery)',
    'BAMS (Ayurvedic Medicine)',
    'BHMS (Homeopathic Medicine)',
    'B.Sc Nursing / GNM',
    'BPT / MPT (Physiotherapy)',
    'Medical / Healthcare - Other'
  ],
  'Law / Legal': [
    'LLB (Bachelor of Laws - 3 Years)',
    'B.A. LLB / B.B.A. LLB (5 Years Integrated)',
    'LLM (Master of Laws)',
    'Corporate Law Specialist',
    'Law - Other'
  ],
  'Architecture / Design': [
    'B.Arch (Bachelor of Architecture)',
    'M.Arch (Master of Architecture)',
    'B.Des (Bachelor of Design - UI/UX, Product, Fashion)',
    'M.Des (Master of Design)',
    'B.Plan / M.Plan (Urban Planning)',
    'Interior Design (Degree / Diploma)',
    'Architecture / Design - Other'
  ],
  'ITI / Trade': [
    'ITI Electrician',
    'ITI Fitter',
    'ITI Machinist',
    'ITI Turner',
    'ITI Welder',
    'ITI Wireman',
    'ITI Motor Mechanic / Diesel Mechanic',
    'ITI Draughtsman (Mechanical / Civil)',
    'ITI COPA (Computer Operator & Programming Assistant)',
    'ITI Instrument Mechanic',
    'ITI Plumber / Carpenter',
    'ITI - All Trades'
  ],
  '12th / HSC': [
    '12th (HSC) - Science',
    '12th (HSC) - Commerce',
    '12th (HSC) - Arts',
    '12th (HSC) - Vocational / MCVC',
    '12th (HSC) - Any Stream'
  ],
  '10th / SSC': [
    '10th (SSC) - Pass',
    '10th (SSC) - CBSE / ICSE / State Board'
  ],
  'Other / Certification': [
    'Self-Taught / Bootcamp Certified',
    'Certification - Cloud (AWS / Azure / GCP)',
    'Certification - Full Stack / Software Development',
    'Certification - Data Science & AI',
    'Certification - Digital Marketing & SEO',
    'Other Non-Traditional Degree / Certification'
  ],
  // Legacy aliases for backward compatibility with existing records
  'Diploma': [
    'Diploma (General)',
    'Diploma in Computer Engineering / IT',
    'Diploma in Mechanical Engineering',
    'Diploma in Electrical Engineering',
    'Diploma in Civil Engineering',
    'Diploma in Electronics & Telecommunication (E&TC)',
    'Diploma in Automobile Engineering',
    'Diploma - Any Stream'
  ],
  'Graduate': [
    'Graduate (General)',
    'Any Graduate',
    'B.E/B.Tech',
    'B.Tech',
    'BCA',
    'B.Sc',
    'B.Com',
    'B.A',
    'B.B.A'
  ],
  'HSC': [
    '12th (HSC) - Science',
    '12th (HSC) - Commerce',
    '12th (HSC) - Arts',
    'HSC - Any'
  ],
  'ITI': [
    'ITI Electrician',
    'ITI Fitter',
    'ITI Machinist',
    'ITI Turner',
    'ITI Welder',
    'ITI - All Trade'
  ],
  'Post-Graduate': [
    'Post-Graduate (General)',
    'Any Post-Graduate',
    'MBA',
    'MCA',
    'M.Tech',
    'M.Sc',
    'M.Com',
    'M.A'
  ],
  'SSC': [
    '10th (SSC) - Pass',
    'Pass'
  ]
};

export interface EducationCategory {
  category: string;
  icon: string;
  degrees: string[];
}

export const CATEGORIZED_EDUCATION_DEGREES: EducationCategory[] = EDUCATION_QUALIFICATIONS.map(qual => ({
  category: qual,
  icon: EDUCATION_QUALIFICATION_ICONS[qual] || '',
  degrees: EDUCATION_SPECIALIZATIONS[qual] || []
}));

// All unique specializations flattened
export const ALL_EDUCATION_DEGREES: string[] = Array.from(
  new Set(EDUCATION_QUALIFICATIONS.flatMap(qual => EDUCATION_SPECIALIZATIONS[qual] || []))
);

// Helper: Get specializations for a given qualification
export function getSpecializationsForQualification(qualification: string): string[] {
  if (!qualification) return [];
  const match = EDUCATION_QUALIFICATIONS.find(
    q => q.toLowerCase() === qualification.trim().toLowerCase()
  );
  if (match) {
    return EDUCATION_SPECIALIZATIONS[match] || [];
  }
  return [];
}

// Helper: Find qualification(s) for a given specialization
export function getQualificationForSpecialization(specialization: string): EducationQualification[] {
  if (!specialization) return [];
  const norm = specialization.trim().toLowerCase();
  const results: EducationQualification[] = [];

  // Direct keyword matching for fast-track resolution
  if (norm.includes('b.tech') || norm.includes('btech') || norm.includes('b.e') || norm.includes('engineering')) {
    results.push('B.Tech / B.E.');
  }
  if (norm.includes('mba') || norm.includes('pgdm')) {
    results.push('MBA / PGDM');
  }
  if (norm.includes('bca') || norm.includes('mca')) {
    results.push('BCA / MCA');
  }
  if (norm.includes('diploma') || norm.includes('polytechnic')) {
    results.push('Diploma / Polytechnic');
  }
  if (norm.includes('phd') || norm.includes('ph.d') || norm.includes('doctorate')) {
    results.push('Doctorate / Ph.D.');
  }
  if (norm.includes('ca ') || norm.includes(' chartered') || norm.includes('icwa') || norm.includes('cma') || norm.includes('cfa')) {
    results.push('Chartered / Professional (CA, CS, CMA)');
  }

  for (const qual of EDUCATION_QUALIFICATIONS) {
    if (EDUCATION_SPECIALIZATIONS[qual]?.some(s => s.toLowerCase() === norm || norm.includes(s.toLowerCase()))) {
      if (!results.includes(qual)) {
        results.push(qual);
      }
    }
  }

  return results;
}

export { isEducationMatching } from '../utils/educationMatcher';
