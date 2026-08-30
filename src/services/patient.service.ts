import api from "@/lib/api";

export class PatientService {
  public static async getPatientDetails(patientId: string) {
    const res = await api.get(`/patients/${patientId}`);
    return res.data?.data || res.data;
  }

  public static async updatePatientProfile(patientId: string, payload: Record<string, unknown>) {
    const res = await api.patch(`/patients/${patientId}`, payload);
    return res.data?.data || res.data;
  }

  public static async createPatient(payload: Record<string, unknown>) {
    const res = await api.post("/patients", payload);
    return res.data?.data || res.data;
  }
}
