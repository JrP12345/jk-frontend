import api from "@/lib/api";

export class PatientService {
  public static async searchPatients(query?: string) {
    const url = query ? `/patients?search=${encodeURIComponent(query)}` : "/patients";
    const res = await api.get(url);
    return res.data?.data || res.data;
  }

  public static async getPatientDetails(patientId: string) {
    const res = await api.get(`/patients/${patientId}`);
    return res.data?.data || res.data;
  }

  public static async searchPatientRecords(patientId: string, q: string, category = "all") {
    const res = await api.get(`/patients/${patientId}/search?q=${encodeURIComponent(q)}&category=${category}`);
    return res.data?.data || res.data;
  }
}
