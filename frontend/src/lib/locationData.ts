// Curated Country → State → City dataset for the public application form.
// India is the primary market; other countries cover major engineering hubs.
// "Other" country/state/city always fall back to free-text entry.

export interface City { name: string }
export interface State { name: string; cities: City[] }
export interface Country { name: string; states: State[] }

const indiaStates: Array<[string, string[]]> = [
  ["Andhra Pradesh", ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Kurnool"]],
  ["Arunachal Pradesh", ["Itanagar", "Naharlagun", "Tawang"]],
  ["Assam", ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Tezpur"]],
  ["Bihar", ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"]],
  ["Chandigarh", ["Chandigarh"]],
  ["Chhattisgarh", ["Raipur", "Bhilai", "Bilaspur", "Durg"]],
  ["Delhi", ["New Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh", "Janakpuri"]],
  ["Goa", ["Panaji", "Margao", "Vasco da Gama", "Mapusa"]],
  ["Gujarat", ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar"]],
  ["Haryana", ["Gurugram", "Faridabad", "Panipat", "Ambala", "Karnal", "Sonipat"]],
  ["Himachal Pradesh", ["Shimla", "Dharamshala", "Manali", "Solan", "Mandi"]],
  ["Jammu and Kashmir", ["Srinagar", "Jammu", "Anantnag"]],
  ["Jharkhand", ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro"]],
  ["Karnataka", ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"]],
  ["Kerala", ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kannur"]],
  ["Madhya Pradesh", ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar"]],
  ["Maharashtra", ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Navi Mumbai", "Aurangabad", "Solapur"]],
  ["Manipur", ["Imphal"]],
  ["Meghalaya", ["Shillong", "Tura"]],
  ["Mizoram", ["Aizawl"]],
  ["Nagaland", ["Kohima", "Dimapur"]],
  ["Odisha", ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur"]],
  ["Puducherry", ["Puducherry", "Karaikal"]],
  ["Punjab", ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Patiala"]],
  ["Rajasthan", ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner"]],
  ["Sikkim", ["Gangtok"]],
  ["Tamil Nadu", ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"]],
  ["Telangana", ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad"]],
  ["Tripura", ["Agartala"]],
  ["Uttar Pradesh", ["Lucknow", "Noida", "Ghaziabad", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Greater Noida"]],
  ["Uttarakhand", ["Dehradun", "Haridwar", "Nainital", "Haldwani", "Rishikesh"]],
  ["West Bengal", ["Kolkata", "Howrah", "Siliguri", "Durgapur", "Asansol"]],
];

const otherCountries: Array<[string, Array<[string, string[]]>]> = [
  ["United States", [["California", ["San Francisco", "Los Angeles", "San Diego"]], ["Texas", ["Austin", "Houston", "Dallas"]], ["New York", ["New York City", "Buffalo"]], ["Washington", ["Seattle", "Bellevue"]], ["Illinois", ["Chicago"]], ["New Jersey", ["Newark", "Jersey City"]]]],
  ["United Kingdom", [["England", ["London", "Manchester", "Birmingham", "Leeds"]], ["Scotland", ["Edinburgh", "Glasgow"]], ["Wales", ["Cardiff"]], ["Northern Ireland", ["Belfast"]]]],
  ["United Arab Emirates", [["Dubai", ["Dubai"]], ["Abu Dhabi", ["Abu Dhabi"]], ["Sharjah", ["Sharjah"]]]],
  ["Singapore", [["Singapore", ["Singapore"]]]],
  ["Canada", [["Ontario", ["Toronto", "Ottawa"]], ["British Columbia", ["Vancouver"]], ["Alberta", ["Calgary", "Edmonton"]], ["Quebec", ["Montreal"]]]],
  ["Australia", [["New South Wales", ["Sydney"]], ["Victoria", ["Melbourne"]], ["Queensland", ["Brisbane"]], ["Western Australia", ["Perth"]]]],
  ["Germany", [["Bavaria", ["Munich"]], ["Berlin", ["Berlin"]], ["Hesse", ["Frankfurt"]], ["North Rhine-Westphalia", ["Cologne", "Düsseldorf"]]]],
  ["Malaysia", [["Kuala Lumpur", ["Kuala Lumpur"]], ["Selangor", ["Petaling Jaya"]]]],
  ["Nepal", [["Bagmati", ["Kathmandu", "Lalitpur"]]]],
  ["Bangladesh", [["Dhaka", ["Dhaka"]], ["Chittagong", ["Chattogram"]]]],
];

export const COUNTRIES: Country[] = [
  { name: "India", states: indiaStates.map(([name, cities]) => ({ name, cities: cities.map((c) => ({ name: c })) })) },
  ...otherCountries.map(([name, states]) => ({
    name,
    states: states.map(([s, cities]) => ({ name: s, cities: cities.map((c) => ({ name: c })) })),
  })),
  { name: "Other", states: [] },
];

export const QUALIFICATIONS = [
  "10th", "12th", "Diploma", "ITI", "Undergraduate", "Graduate",
  "Postgraduate", "Master's Degree", "PhD", "Other",
] as const;

export const EMPLOYMENT_STATUS = [
  "Fresher", "Employed (Full-time)", "Employed (Contract)", "Self-employed", "On Notice", "Not Employed",
] as const;

export const NOTICE_PERIODS = [
  "Immediate", "15 days", "30 days", "45 days", "60 days", "90 days", "More than 90 days",
] as const;
