import app from "./app.js";
import { PORT } from "./config/constants.js";

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
