import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tsv_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const formatApiError = (err) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Unknown error";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail.msg) return detail.msg;
  return String(detail);
};

export const downloadFile = async (path, params, defaultName) => {
  const token = localStorage.getItem("tsv_token");
  const res = await axios.get(`${BACKEND_URL}/api${path}`, {
    params,
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const blob = new Blob([res.data], { type: res.headers["content-type"] });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  const cd = res.headers["content-disposition"] || "";
  const m = cd.match(/filename="([^"]+)"/);
  a.href = url;
  a.download = m ? m[1] : defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
