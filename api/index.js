import serverless from "serverless-http";
import { app } from "../app.js";

// Every request Vercel routes to this function (see vercel.json's rewrite)
// is handled by the same Express app used locally — same routes, same logic.
export default serverless(app);
