import express from "express";
import offersRouter from "../src/modules/offers";
import { errorHandler } from "../src/middleware/error";
const app = express();
app.use(express.json());
app.use("/api/v1/offers", offersRouter);
app.use(errorHandler);
app.listen(5098, () => console.log("test route on 5098"));
