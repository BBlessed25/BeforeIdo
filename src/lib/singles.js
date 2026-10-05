export const SINGLES_AGES = ["18–24", "25–29", "30–34", "35–39", "40–49", "50+"];
export const SINGLES_GENDERS = ["Male", "Female"];
export const SINGLES_ATTENDANCE = ["Yes", "No", "Visiting for the first time"];
export const SINGLES_EXPECTATIONS = [
  "Meet new people",
  "Make new friendships",
  "Connect with other Christian singles",
  "Open to meeting someone",
  "Just here to have fun! 😊",
];
export const SINGLES_DIETARY = ["No", "Yes — please specify"];
export const SINGLES_FUTURE = ["Yes", "No"];
export const SINGLES_HEADERS = [
  "Submission ID",
  "Submitted At",
  "Full Name",
  "Phone Number",
  "Email Address",
  "Age Range",
  "Gender",
  "Gospel Pillars Church Attendance",
  "Event Expectations",
  "Dietary Restrictions or Allergies",
  "Dietary Details",
  "Future Singles Events Opt-In",
];
export const SINGLES_SUCCESS =
  "Thank you for registering! 💕 We’re excited to welcome you to Before I do – The Singles Experience. We look forward to seeing you! ❤️";

export function validateSingles(body) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  /** @type {Record<string, string>} */
  const errors = {};
  const text = (key) => (typeof source[key] === "string" ? source[key].trim() : "");
  const value = {
    submissionId: text("submissionId"),
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    ageRange: text("ageRange"),
    gender: text("gender"),
    attendance: text("attendance"),
    expectations: [],
    dietary: text("dietary"),
    dietaryDetails: text("dietary") === SINGLES_DIETARY[1] ? text("dietaryDetails") : "",
    futureEvents: text("futureEvents"),
  };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.submissionId
    )
  ) {
    errors.submissionId = "Your registration session is invalid. Please reload the page.";
  }
  if (!value.fullName || value.fullName.length > 150)
    errors.fullName = "Please enter your full name (up to 150 characters).";
  const digits = value.phone.replace(/\D/g, "");
  if (
    !/^\+?[\d\s().-]+$/.test(value.phone) ||
    digits.length < 7 ||
    digits.length > 15 ||
    value.phone.length > 50
  ) {
    errors.phone = "Please enter a valid phone number, including your country code if needed.";
  }
  if (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    errors.email = "Please enter a valid email address.";
  /** @type {Array<[string, string[], boolean]>} */
  const choices = [
    ["ageRange", SINGLES_AGES, true],
    ["gender", SINGLES_GENDERS, true],
    ["attendance", SINGLES_ATTENDANCE, false],
    ["dietary", SINGLES_DIETARY, false],
    ["futureEvents", SINGLES_FUTURE, false],
  ];
  for (const [key, options, required] of choices) {
    if ((required || value[key]) && !options.includes(value[key]))
      errors[key] = "Please select one of the listed answers.";
    if (source[key] !== undefined && typeof source[key] !== "string")
      errors[key] = "Please select one of the listed answers.";
  }
  if (
    source.expectations !== undefined &&
    (!Array.isArray(source.expectations) ||
      source.expectations.some((item) => !SINGLES_EXPECTATIONS.includes(item)))
  ) {
    errors.expectations = "Please select only the listed expectations.";
  } else {
    value.expectations = SINGLES_EXPECTATIONS.filter((item) =>
      (source.expectations || []).includes(item)
    );
  }
  if (
    value.dietary === SINGLES_DIETARY[1] &&
    (!value.dietaryDetails || value.dietaryDetails.length > 1000)
  ) {
    errors.dietaryDetails =
      "Please specify your dietary restrictions or allergies (up to 1,000 characters).";
  }
  return { errors, value };
}

export function singlesRow(value, submittedAt) {
  return [
    value.submissionId,
    submittedAt,
    value.fullName,
    value.phone,
    value.email,
    value.ageRange,
    value.gender,
    value.attendance,
    value.expectations.join("; "),
    value.dietary,
    value.dietaryDetails,
    value.futureEvents,
  ];
}
