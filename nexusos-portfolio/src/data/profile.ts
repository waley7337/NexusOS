/**
 * Profile facts. Every value here is taken from Waley's own documents
 * (CV, degree certificate, NexusOS case study and portfolio summary) —
 * nothing is inferred or embellished.
 */

export const profile = {
  name: "Waley El-Nagdi",
  role: "Software Developer",
  focus: "Backend Development & Systems Integration",
  stack: ["Python", "REST APIs", "PostgreSQL", "Business Applications"],
  pitch:
    "A self-taught developer applying for a company placement through the AQUA pathway toward the Lehrabschlussprüfung (LAP) in Applikationsentwicklung – Coding.",
  location: "St. Pölten, Austria",
  availability: "Full-time · remote preferred · willing to travel",
  email: "waleyelnagdi7@gmail.com",
  github: "https://github.com/waley7337",
  repo: "https://github.com/waley7337/NexusOS",
};

export const approach = [
  {
    title: "Understand first",
    body: "I try to understand the code, the architectural choices and the trade-offs behind a solution before I rely on it.",
  },
  {
    title: "Question the output",
    body: "I use LLMs as learning assistants and treat generated answers as proposals to check, not as facts.",
  },
  {
    title: "Stay honest",
    body: "I do not yet understand every component of my projects equally well — and I am actively building that competence.",
  },
];

export const stats = [
  { value: "5", label: "Architecture layers" },
  { value: "7", label: "Security layers" },
  { value: "~110", label: "Security tests" },
  { value: "31", label: "UI components" },
];

export const education = {
  institution: "Université de Strasbourg",
  degree: "Licence",
  field: "Langues, littératures étrangères et régionales — Département d'études anglophones",
  honours: "Mention bien",
  academicYear: "2019–2020",
  awarded: "30 June 2020",
  cvWording: "Licence – Anglistik / Englische Studien, 2016–2020",
  further: {
    institution: "LISAA – Institut Supérieur des Arts Appliqués",
    detail: "Hochschulausbildung in angewandter Kunst",
    years: "2021–2022",
  },
};

export const otherProjects = [
  {
    name: "Pentest Report Generator (v1)",
    detail: "Python & Streamlit tool that processes Nessus scan files, merges duplicate findings and produces structured PDF reports.",
  },
  {
    name: "Ghost Protocol",
    detail: "Completed security-oriented project focused on systematic testing, technical documentation and structured problem-solving.",
  },
];
