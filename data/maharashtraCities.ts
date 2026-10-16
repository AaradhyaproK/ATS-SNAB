export interface StateCityGroup {
  state: string;
  cities: string[];
}

export const INDIAN_STATES_CITIES: StateCityGroup[] = [
  {
    state: "Maharashtra",
    cities: [
      "Nashik",
      "Pune",
      "Mumbai",
      "Thane",
      "Nagpur",
      "Chhatrapati Sambhajinagar",
      "Navi Mumbai",
      "Solapur",
      "Amravati",
      "Kolhapur",
      "Sangli",
      "Jalgaon",
      "Akola",
      "Latur",
      "Dhule",
      "Ahmednagar",
      "Chandrapur",
      "Parbhani",
      "Ichalkaranji",
      "Jalna",
      "Nanded",
      "Satara",
      "Beed",
      "Yavatmal",
      "Gondia",
      "Bhandara",
      "Baramati",
      "Ratnagiri",
      "Wardha",
      "Osmanabad (Dharashiv)",
      "Palghar",
      "Vasai-Virar",
      "Bhiwandi",
      "Panvel",
      "Badlapur",
      "Ambernath",
      "Mira-Bhayandar",
      "Kalyan-Dombivli",
      "Pimpri-Chinchwad",
      "Sindhudurg",
      "Nandurbar",
      "Hingoli",
      "Gadchiroli"
    ]
  },
  {
    state: "Delhi NCR",
    cities: ["Delhi", "New Delhi", "Gurgaon", "Noida", "Greater Noida", "Ghaziabad", "Faridabad"]
  },
  {
    state: "Karnataka",
    cities: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi-Dharwad", "Belagavi", "Davangere", "Ballari", "Tumakuru", "Shivamogga"]
  },
  {
    state: "Telangana & Andhra Pradesh",
    cities: ["Hyderabad", "Secunderabad", "Warangal", "Nizamabad", "Karimnagar", "Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore", "Kakinada", "Rajahmundry", "Kurnool", "Anantapur"]
  },
  {
    state: "Tamil Nadu",
    cities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Tirunelveli", "Thoothukudi", "Thanjavur", "Dindigul", "Hosur"]
  },
  {
    state: "Gujarat",
    cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Vapi", "Ankleshwar", "Bharuch", "Navsari", "Morbi", "Mehsana"]
  },
  {
    state: "Madhya Pradesh",
    cities: ["Indore", "Bhopal", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Rewa", "Satna", "Ratlam", "Singrauli", "Burhanpur", "Chhindwara"]
  },
  {
    state: "Rajasthan",
    cities: ["Jaipur", "Udaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Bhilwara", "Alwar", "Sikar", "Sri Ganganagar", "Bharatpur", "Pali"]
  },
  {
    state: "Uttar Pradesh",
    cities: ["Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Meerut", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur", "Jhansi", "Mathura", "Saharanpur", "Ayodhya", "Firozabad", "Muzaffarnagar"]
  },
  {
    state: "West Bengal & Odisha",
    cities: ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol", "Kharagpur", "Haldia", "Bhubaneswar", "Cuttack", "Rourkela", "Puri", "Sambalpur", "Berhampur"]
  },
  {
    state: "Bihar & Jharkhand",
    cities: ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia", "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh"]
  },
  {
    state: "Punjab, Haryana & Chandigarh",
    cities: ["Chandigarh", "Mohali", "Panchkula", "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Ambala", "Karnal", "Panipat", "Rohtak", "Hisar", "Yamunanagar", "Sonipat"]
  },
  {
    state: "Kerala & Goa",
    cities: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Panaji", "Margao", "Vasco da Gama", "Mapusa"]
  },
  {
    state: "Uttarakhand, HP & J&K",
    cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rishikesh", "Rudrapur", "Shimla", "Dharamshala", "Mandi", "Jammu", "Srinagar", "Anantnag"]
  },
  {
    state: "Assam & North East",
    cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tezpur", "Shillong", "Imphal", "Agartala", "Aizawl", "Kohima", "Itanagar", "Gangtok"]
  },
  {
    state: "Chhattisgarh",
    cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon", "Jagdalpur"]
  }
];

export const TOP_FAST_FEED_CITIES = [
  { city: "Nashik", state: "Maharashtra" },
  { city: "Pune", state: "Maharashtra" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "Thane", state: "Maharashtra" },
  { city: "Nagpur", state: "Maharashtra" },
  { city: "Chhatrapati Sambhajinagar", state: "Maharashtra" }
];

export const MAHARASHTRA_CITIES = INDIAN_STATES_CITIES.flatMap(g => g.cities);

export function getStateForCity(cityName: string): string {
  if (!cityName) return '';
  const cleanCity = cityName.toLowerCase().trim();
  for (const group of INDIAN_STATES_CITIES) {
    if (group.cities.some(c => c.toLowerCase().includes(cleanCity) || cleanCity.includes(c.toLowerCase()) || isCityMatchingQuery(c, cleanCity))) {
      return group.state;
    }
  }
  return '';
}

export const CITY_ALIAS_MAP: Array<[string, string[]]> = [
  ["Nashik", ["nashik", "nasik", "ambad", "ambad midc", "satpur", "satpur midc", "gonde", "sinnar", "sinnar midc", "musalgaon", "dindori", "igatpuri", "panchavati", "cidco", "pathardi", "pathardi phata", "deolali", "devlali", "ozar", "ojhar", "pimpalgaon", "lasalgaon", "yeola"]],
  ["Navi Mumbai", ["navi mumbai", "vashi", "airoli", "ghansoli", "mahpe", "mahape", "rabale", "koparkhairane", "nerul", "kharghar", "belapur", "cbd belapur", "taloja", "turbhe", "juinagar", "seawoods"]],
  ["Mumbai", ["mumbai", "bombay", "andheri", "bandra", "kurla", "worli", "dadar", "borivali", "powai", "chembur", "colaba", "malad", "ghatkopar", "juhu", "santacruz", "marol", "seepz", "bkc", "lower parel", "nariman point", "kandivali", "dahisar", "goregaon", "vikhroli", "mulund"]],
  ["Pimpri-Chinchwad", ["pimpri-chinchwad", "pimpri chinchwad", "chakan", "bhosari", "bhosari midc", "nigdi", "akurdi", "tathawade", "ravet", "talwade"]],
  ["Pune", ["pune", "poona", "hinjewadi", "hinjawadi", "hadapsar", "magarpatta", "talegaon", "ranjangaon", "wakad", "baner", "viman nagar", "kothrud", "katraj", "kharadi", "yerwada", "wagholi", "alandi", "shirwal", "bhosari", "chakan", "pcmc", "pimpri"]],
  ["Thane", ["thane", "majiwada", "ghodbunder", "kalwa", "mumbra", "wagle estate"]],
  ["Kalyan-Dombivli", ["kalyan", "dombivli", "dombivali", "titwala"]],
  ["Vasai-Virar", ["vasai", "virar", "nallasopara", "naigaon"]],
  ["Bhiwandi", ["bhiwandi"]],
  ["Panvel", ["panvel", "kamothe", "kalamboli", "taloja", "khandeshwar"]],
  ["Badlapur", ["badlapur"]],
  ["Ambernath", ["ambernath"]],
  ["Mira-Bhayandar", ["mira bhayandar", "bhayandar", "mira road"]],
  ["Palghar", ["palghar", "boisar", "tarapur"]],
  ["Nagpur", ["nagpur", "butibori", "butibori midc", "hingna", "hingna midc", "kamthi", "mihan", "wadi"]],
  ["Chhatrapati Sambhajinagar", ["aurangabad", "sambhajinagar", "chhatrapati sambhajinagar", "waluj", "waluj midc", "chikalthana", "chikalthana midc", "shendra", "shendra midc", "paithan"]],
  ["Solapur", ["solapur", "sholapur"]],
  ["Amravati", ["amravati"]],
  ["Kolhapur", ["kolhapur", "gokul shirgaon", "shiroli", "shiroli midc", "uchgaon", "gadhinglaj", "ichalkaranji"]],
  ["Sangli", ["sangli", "miraj"]],
  ["Jalgaon", ["jalgaon", "bhusawal"]],
  ["Akola", ["akola"]],
  ["Latur", ["latur"]],
  ["Dhule", ["dhule"]],
  ["Ahmednagar", ["ahmednagar", "nagar"]],
  ["Chandrapur", ["chandrapur"]],
  ["Parbhani", ["parbhani"]],
  ["Ichalkaranji", ["ichalkaranji"]],
  ["Jalna", ["jalna"]],
  ["Nanded", ["nanded"]],
  ["Satara", ["satara", "karad"]],
  ["Beed", ["beed"]],
  ["Yavatmal", ["yavatmal"]],
  ["Gondia", ["gondia"]],
  ["Bhandara", ["bhandara"]],
  ["Baramati", ["baramati"]],
  ["Ratnagiri", ["ratnagiri"]],
  ["Wardha", ["wardha"]],
  ["Osmanabad (Dharashiv)", ["osmanabad", "dharashiv"]],
  ["Sindhudurg", ["sindhudurg", "kudal", "kankavli"]],
  ["Nandurbar", ["nandurbar"]],
  ["Hingoli", ["hingoli"]],
  ["Gadchiroli", ["gadchiroli"]],
  ["Delhi", ["delhi", "new delhi", "ncr", "gurgaon", "gurugram", "noida", "ghaziabad", "faridabad"]],
  ["Bengaluru", ["bengaluru", "bangalore", "electronic city", "whitefield", "koramangala", "indiranagar"]],
  ["Hyderabad", ["hyderabad", "secunderabad", "hitech city", "gachibowli"]],
  ["Chennai", ["chennai", "madras", "guindy", "omr", "velachery"]],
  ["Kolkata", ["kolkata", "calcutta", "salt lake", "rajarhat"]],
  ["Ahmedabad", ["ahmedabad", "gujarat", "sanand", "changodar"]],
  ["Surat", ["surat", "hazira"]],
  ["Vadodara", ["vadodara", "baroda"]],
  ["Indore", ["indore", "pithampur"]],
  ["Jaipur", ["jaipur"]],
  ["Chandigarh", ["chandigarh", "mohali"]]
];

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenA; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[lenB][lenA];
}

export function isCityMatchingQuery(cityName: string, rawQuery: string): boolean {
  if (!rawQuery.trim()) return true;
  const query = rawQuery.toLowerCase().trim();
  const target = cityName.toLowerCase().trim();

  // 1. Direct Substring Match
  if (target.includes(query) || query.includes(target)) return true;

  // 2. Check Aliases (e.g. nasik -> Nashik, poona -> Pune, aurangabad -> Chhatrapati Sambhajinagar)
  const aliasMatch = CITY_ALIAS_MAP.find(([official]) => official.toLowerCase() === target);
  if (aliasMatch) {
    const [, aliases] = aliasMatch;
    if (aliases.some(alias => alias.includes(query) || query.includes(alias))) {
      return true;
    }
  }

  // 3. Typo-Tolerant Fuzzy Levenshtein Match
  const maxDistance = query.length >= 6 ? 2 : query.length >= 3 ? 1 : 0;
  if (maxDistance > 0) {
    const dist = getLevenshteinDistance(query, target);
    if (dist <= maxDistance) return true;

    const words = target.split(/\s+|-|\(/);
    for (const w of words) {
      const cleanW = w.replace(/[^a-z0-9]/g, '');
      if (cleanW.length >= 3) {
        if (getLevenshteinDistance(query, cleanW) <= maxDistance) return true;
      }
    }

    if (aliasMatch) {
      for (const alias of aliasMatch[1]) {
        if (getLevenshteinDistance(query, alias) <= maxDistance) return true;
      }
    }
  }

  return false;
}

export function resolveStrictListedCity(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  const cleanText = rawText.toLowerCase().replace(/[^a-z0-9\s,-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanText) return '';

  for (const city of MAHARASHTRA_CITIES) {
    const cityClean = city.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
    if (cleanText.includes(cityClean)) {
      return city;
    }
  }

  for (const [officialCity, aliases] of CITY_ALIAS_MAP) {
    for (const alias of aliases) {
      const aliasClean = alias.toLowerCase().trim();
      const regex = new RegExp(`\\b${aliasClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(cleanText) || cleanText.includes(aliasClean)) {
        return officialCity;
      }
    }
  }

  return '';
}

/**
 * Checks if two location strings match geographically.
 * Handles localities, industrial areas, MIDCs, and city aliases (e.g. "Ambad" matches "Nashik", "Hinjewadi" matches "Pune").
 */
export function isLocationMatching(loc1: string, loc2: string): boolean {
  if (!loc1 || !loc2) return true;
  const clean1 = loc1.toLowerCase().trim();
  const clean2 = loc2.toLowerCase().trim();
  if (!clean1 || !clean2) return true;

  // Remote / Any match
  const openTerms = ['remote', 'any', 'all india', 'work from home', 'wfh', 'pan india', 'open', 'not specified', 'anywhere'];
  if (openTerms.some(t => clean1.includes(t) || clean2.includes(t))) {
    return true;
  }

  // 1. Direct exact or substring match
  if (clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1)) {
    return true;
  }

  // 2. Token Matching (e.g. "Ambad, Nashik" matches "Nashik", "Ambad MIDC" matches "Ambad")
  const tokens1 = clean1.split(/[\s,/-]+/).filter(t => t.length > 2);
  const tokens2 = clean2.split(/[\s,/-]+/).filter(t => t.length > 2);
  const hasTokenMatch = tokens1.some(t1 =>
    tokens2.some(t2 => t1 === t2 || (t1.length >= 4 && t2.length >= 4 && (t1.includes(t2) || t2.includes(t1))))
  );
  if (hasTokenMatch) {
    return true;
  }

  // 3. Resolve parent city via resolveStrictListedCity
  const resolvedCity1 = resolveStrictListedCity(clean1);
  const resolvedCity2 = resolveStrictListedCity(clean2);
  if (resolvedCity1 && resolvedCity2 && resolvedCity1.toLowerCase() === resolvedCity2.toLowerCase()) {
    return true;
  }

  // 4. Check CITY_ALIAS_MAP clusters (e.g. "Ambad" and "Nashik" belong to the same Nashik cluster)
  for (const [officialCity, aliases] of CITY_ALIAS_MAP) {
    const allNames = [officialCity.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
    const match1 = allNames.some(name => clean1.includes(name) || name.includes(clean1));
    const match2 = allNames.some(name => clean2.includes(name) || name.includes(clean2));
    if (match1 && match2) {
      return true;
    }
  }

  // 5. Check isCityMatchingQuery bidirectional
  if (isCityMatchingQuery(clean1, clean2) || isCityMatchingQuery(clean2, clean1)) {
    return true;
  }

  return false;
}

