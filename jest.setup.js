// jest.setup.js
import axios from "axios";

axios.defaults.adapter = "http";

console.log("[jest setup] axios adapter forced to:", axios.defaults.adapter);
