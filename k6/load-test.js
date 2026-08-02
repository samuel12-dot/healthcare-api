import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import encoding from "k6/encoding";

/**
 * Load test for the Patient Records & Appointments API.
 *
 * Simulates a realistic mix for a clinic-hours workload: mostly reads
 * (patients checking their own records/appointments, clinicians listing
 * patients they have access to) with a light stream of writes (booking
 * appointments). Run against a seeded database -- see README "Load testing"
 * section for the one-time setup this script expects.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 \
 *   PATIENT_EMAIL=loadtest-patient@healthcare.local \
 *   PATIENT_PASSWORD=loadtest-password-1 \
 *   CLINICIAN_ID=<uuid> \
 *   k6 run k6/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const PATIENT_EMAIL = __ENV.PATIENT_EMAIL || "loadtest-patient@healthcare.local";
const PATIENT_PASSWORD = __ENV.PATIENT_PASSWORD || "loadtest-password-1";
const CLINICIAN_ID = __ENV.CLINICIAN_ID || "";

const rateLimited = new Counter("rate_limited_responses");

export const options = {
  scenarios: {
    read_heavy: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 20 },
        { duration: "40s", target: 20 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: PATIENT_EMAIL, password: PATIENT_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(loginRes, { "setup login succeeded": (r) => r.status === 200 });
  const body = loginRes.json();

  // The login response's user.id is the *User* row's id -- the JWT's
  // patientId claim (the Patient row id) is what every /patients/:id/*
  // route actually expects, so it's decoded straight from the token
  // rather than re-deriving it from the user id.
  const payload = JSON.parse(encoding.b64decode(body.accessToken.split(".")[1], "rawurl", "s"));

  return { accessToken: body.accessToken, patientId: payload.patientId };
}

export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.accessToken}`,
  };

  const health = http.get(`${BASE_URL}/health`);
  check(health, { "health is 200": (r) => r.status === 200 });

  const records = http.get(`${BASE_URL}/api/v1/patients/${data.patientId}/records?limit=20`, { headers });
  check(records, { "records list ok": (r) => r.status === 200 });
  if (records.status === 429) rateLimited.add(1);

  const appointments = http.get(`${BASE_URL}/api/v1/patients/${data.patientId}/appointments?limit=20`, {
    headers,
  });
  check(appointments, { "appointments list ok": (r) => r.status === 200 });
  if (appointments.status === 429) rateLimited.add(1);

  if (CLINICIAN_ID) {
    const date = new Date().toISOString().slice(0, 10);
    const availability = http.get(`${BASE_URL}/api/v1/clinicians/${CLINICIAN_ID}/availability?date=${date}`, {
      headers,
    });
    check(availability, { "availability ok": (r) => r.status === 200 });
  }

  sleep(1);
}
