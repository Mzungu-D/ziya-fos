import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Ziya FOS API running on http://localhost:${PORT}`);
});